import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { API_URL } from '../config';

const RoomChat = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState(location.state?.room || null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [roomUsers, setRoomUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyingToMsg, setReplyingToMsg] = useState(null);

  const { user } = useAuth();
  const { socket } = useSocket();
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Fetch room details if not passed via state
  useEffect(() => {
    const fetchRoom = async () => {
      if (!room) {
        try {
          const res = await axios.get(`${API_URL}/api/rooms/number/${roomId}`);
          setRoom(res.data);
        } catch (error) {
          console.error('Error fetching room:', error);
          navigate('/rooms');
        }
      }
      setLoading(false);
    };

    fetchRoom();
  }, [roomId, room, navigate]);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      if (room?._id) {
        try {
          const res = await axios.get(`${API_URL}/api/rooms/${room._id}/messages`);
          setMessages(res.data);
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      }
    };

    fetchMessages();
  }, [room]);

  // Socket events for room
  useEffect(() => {
    if (socket && room?._id && user) {
      // Join room
      socket.emit('joinRoom', {
        roomId: room._id,
        userId: user._id,
        username: user.username
      });

      // Listen for new messages
      socket.on('roomMessage', (data) => {
        setMessages((prev) => [...prev, {
          _id: data.messageId,
          sender: { _id: data.senderId, username: data.senderName },
          text: data.text,
          createdAt: data.createdAt || new Date(),
          replyTo: data.replyTo ? {
            _id: data.replyTo,
            text: data.replyToText,
            sender: { username: data.replyToSenderName }
          } : null
        }]);
      });

      // Listen for room users updates
      socket.on('roomUsers', ({ users }) => {
        setRoomUsers(users);
      });

      // Listen for user joined
      socket.on('userJoinedRoom', ({ username }) => {
        setMessages((prev) => [...prev, {
          type: 'system',
          text: `${username} joined the room`,
          createdAt: new Date()
        }]);
      });

      // Listen for user left
      socket.on('userLeftRoom', ({ username }) => {
        setMessages((prev) => [...prev, {
          type: 'system',
          text: `${username} left the room`,
          createdAt: new Date()
        }]);
      });

      // Typing indicators
      socket.on('userTypingInRoom', ({ userId, username }) => {
        setTypingUsers((prev) => {
          if (!prev.find(u => u.userId === userId)) {
            return [...prev, { userId, username }];
          }
          return prev;
        });
      });

      socket.on('userStoppedTypingInRoom', ({ userId }) => {
        setTypingUsers((prev) => prev.filter(u => u.userId !== userId));
      });

      socket.on('roomMessageDeleted', ({ messageId }) => {
        setMessages((prev) => prev.filter(msg => msg._id !== messageId));
      });

      return () => {
        socket.emit('leaveRoom', {
          roomId: room._id,
          userId: user._id,
          username: user.username
        });
        socket.off('roomMessage');
        socket.off('roomUsers');
        socket.off('userJoinedRoom');
        socket.off('userLeftRoom');
        socket.off('userTypingInRoom');
        socket.off('userStoppedTypingInRoom');
        socket.off('roomMessageDeleted');
      };
    }
  }, [socket, room, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !room) return;

    const messageText = newMessage;
    try {
      // Save to database
      const res = await axios.post(`${API_URL}/api/rooms/${room._id}/messages`, {
        text: messageText,
        replyTo: replyingTo
      });

      // Emit socket event for real-time
      socket?.emit('sendRoomMessage', {
        roomId: room._id,
        senderId: user._id,
        senderName: user.username,
        text: messageText,
        messageId: res.data._id,
        createdAt: res.data.createdAt,
        replyTo: replyingTo,
        replyToText: replyingToMsg?.text,
        replyToSenderName: replyingToMsg?.sender?.username
      });

      setNewMessage('');
      setReplyingTo(null);
      setReplyingToMsg(null);
      socket?.emit('roomStopTyping', { roomId: room._id, userId: user._id });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (!room) return;

    socket?.emit('roomTyping', { 
      roomId: room._id, 
      userId: user._id, 
      username: user.username 
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit('roomStopTyping', { roomId: room._id, userId: user._id });
    }, 2000);
  };

  const handleLeaveRoom = async () => {
    try {
      await axios.post(`${API_URL}/api/rooms/${room._id}/leave`);
      navigate('/rooms');
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Check if message can be deleted (within 15 minutes)
  const canDeleteMessage = (messageCreatedAt) => {
    const messageTime = new Date(messageCreatedAt).getTime();
    const currentTime = new Date().getTime();
    const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds
    return (currentTime - messageTime) <= fifteenMinutes;
  };

  const copyRoomNumber = () => {
    navigator.clipboard.writeText(room?.roomNumber || '');
    alert('Room number copied to clipboard!');
  };

  const handleDeleteMessage = async (messageId, messageCreatedAt) => {
    if (!canDeleteMessage(messageCreatedAt)) {
      alert('You can only delete messages within 15 minutes of sending.');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/rooms/${room._id}/messages/${messageId}`);
      setMessages(messages.filter(msg => msg._id !== messageId));
      
      // Emit socket event to notify room members
      socket?.emit('roomMessageDeleted', { roomId: room._id, messageId });
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Failed to delete message');
    }
  };

  const handleReply = (msg) => {
    setReplyingTo(msg._id);
    setReplyingToMsg(msg);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyingToMsg(null);
  };

  if (loading) {
    return <div className="loading">Loading room...</div>;
  }

  return (
    <div className="room-chat-container">
      {/* Sidebar with participants */}
      <div className="room-sidebar">
        <div className="room-info">
          <h2>{room?.name}</h2>
          <div className="room-number-display">
            <span>Room: #{room?.roomNumber}</span>
            <button onClick={copyRoomNumber} className="copy-btn" title="Copy room number">
              📋
            </button>
          </div>
          {room?.description && <p className="room-description">{room?.description}</p>}
        </div>

        <div className="participants-section">
          <h3>Participants ({roomUsers.length})</h3>
          <div className="participants-list">
            {roomUsers.map((u, index) => (
              <div key={index} className="participant-item">
                <div className="participant-avatar">
                  {u.username?.[0]?.toUpperCase() || '?'}
                </div>
                <span>{u.username} {u._id === user._id ? '(You)' : ''}</span>
                <span className="online-dot"></span>
              </div>
            ))}
          </div>
        </div>

        <div className="room-actions">
          <button onClick={handleLeaveRoom} className="leave-btn">
            Leave Room
          </button>
          <button onClick={() => navigate('/rooms')} className="back-btn">
            Back to Rooms
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="room-chat-area">
        <div className="room-messages-container">
          {messages.map((msg, index) => (
            msg.type === 'system' ? (
              <div key={index} className="system-message">
                {msg.text}
              </div>
            ) : (
              <div 
                key={msg._id || index} 
                className={`room-message ${msg.sender?._id === user._id ? 'own' : ''}`}
              >
                {msg.sender?._id !== user._id && (
                  <div className="message-avatar">
                    {msg.sender?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="message-bubble">
                  {msg.replyTo && (
                    <div className="reply-preview-inline">
                      <span className="reply-author">{msg.replyTo?.sender?.username || msg.replyTo?.senderName || 'Unknown'}</span>
                      <p className="reply-text">{msg.replyTo?.text || ''}</p>
                    </div>
                  )}
                  {msg.sender?._id !== user._id && (
                    <span className="sender-name">{msg.sender?.username}</span>
                  )}
                  <p className="message-text">{msg.text}</p>
                  <div className="message-actions">
                    <span className="message-time">{formatTime(msg.createdAt)}</span>
                    <button 
                      className="reply-btn"
                      onClick={() => handleReply(msg)}
                      title="Reply"
                      type="button"
                    >↩</button>
                    {msg.sender?._id === user._id && msg._id && canDeleteMessage(msg.createdAt) && (
                      <button 
                        className="delete-msg-btn"
                        onClick={() => handleDeleteMessage(msg._id, msg.createdAt)}
                        title="Delete message (available for 15 min)"
                        type="button"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          ))}
          <div ref={messagesEndRef} />
        </div>

        {replyingToMsg && (
          <div className="reply-bar">
            <div>
              <span className="reply-author">Replying to {replyingToMsg.sender?.username || 'Unknown'}</span>
              <p className="reply-text">{replyingToMsg.text}</p>
            </div>
            <button type="button" className="close-reply" onClick={handleCancelReply}>✕</button>
          </div>
        )}

        <form className="room-message-input" onSubmit={handleSendMessage}>
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={handleTyping}
          />
          <button type="submit" disabled={!newMessage.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default RoomChat;
