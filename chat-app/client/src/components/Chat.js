import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const Chat = () => {
  const [conversations, setConversations] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyingToMsg, setReplyingToMsg] = useState(null);
  
  const { user, logout } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/messages/conversations');
        setConversations(res.data);
      } catch (error) {
        console.error('Error fetching conversations:', error);
      }
    };

    fetchConversations();
  }, []);

  // Fetch messages when conversation changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (currentChat) {
        try {
          const res = await axios.get(`http://localhost:5000/api/messages/${currentChat._id}`);
          setMessages(res.data);
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      }
    };

    fetchMessages();
  }, [currentChat]);

  // Socket listeners
  useEffect(() => {
    if (socket && currentChat) {
      socket.on('getMessage', (data) => {
        setMessages((prev) => [...prev, {
          _id: data.messageId,
          sender: { _id: data.senderId.toString(), username: data.senderName },
          text: data.text,
          createdAt: data.createdAt || new Date(),
          replyTo: data.replyTo ? {
            _id: data.replyTo,
            text: data.replyToText,
            sender: { username: data.replyToSenderName }
          } : null
        }]);
      });

      socket.on('userTyping', ({ senderId }) => {
        setTypingUser(senderId);
      });

      socket.on('userStoppedTyping', () => {
        setTypingUser(null);
      });

      socket.on('messageDeleted', ({ messageId }) => {
        setMessages((prev) => prev.filter(msg => msg._id !== messageId));
      });

      return () => {
        socket.off('getMessage');
        socket.off('userTyping');
        socket.off('userStoppedTyping');
        socket.off('messageDeleted');
      };
    }
  }, [socket, currentChat]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Search users
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim()) {
        try {
          const res = await axios.get(`http://localhost:5000/api/users/search?query=${searchQuery}`);
          setSearchResults(res.data);
        } catch (error) {
          console.error('Error searching users:', error);
        }
      } else {
        setSearchResults([]);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentChat) return;

    const receiverId = currentChat.participants.find(p => p._id !== user._id)?._id;
    const messageText = newMessage;

    try {
      const res = await axios.post('http://localhost:5000/api/messages', {
        conversationId: currentChat._id,
        text: messageText,
        replyTo: replyingTo
      });

      setMessages((prev) => [...prev, res.data]);
      setNewMessage('');
      setReplyingTo(null);
      setReplyingToMsg(null);

      socket?.emit('sendMessage', {
        senderId: user._id,
        senderName: user.username,
        receiverId,
        text: messageText,
        messageId: res.data._id,
        createdAt: res.data.createdAt,
        replyTo: replyingTo,
        replyToText: replyingToMsg?.text,
        replyToSenderName: replyingToMsg?.sender?.username
      });

      socket?.emit('stopTyping', { senderId: user._id, receiverId });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (!currentChat) return;
    
    const receiverId = currentChat.participants.find(p => p._id !== user.id)?._id;

    socket?.emit('typing', { senderId: user._id, receiverId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit('stopTyping', { senderId: user._id, receiverId });
    }, 2000);
  };

  const startConversation = async (selectedUser) => {
    try {
      const res = await axios.post('http://localhost:5000/api/messages/conversation', {
        receiverId: selectedUser._id
      });

      const conversationWithUser = {
        ...res.data,
        participants: [user, selectedUser]
      };

      setCurrentChat(conversationWithUser);
      setSearchQuery('');
      setSearchResults([]);

      // Add to conversations if not exists
      if (!conversations.find(c => c._id === res.data._id)) {
        setConversations([conversationWithUser, ...conversations]);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const getOtherUser = (conversation) => {
    return conversation.participants?.find(p => p._id !== user.id);
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

  const handleDeleteMessage = async (messageId, messageCreatedAt) => {
    if (!canDeleteMessage(messageCreatedAt)) {
      alert('You can only delete messages within 15 minutes of sending.');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    
    try {
      await axios.delete(`http://localhost:5000/api/messages/${messageId}`);
      setMessages(messages.filter(msg => msg._id !== messageId));
      
      // Emit socket event to notify other user
      const receiverId = currentChat.participants.find(p => p._id !== user.id)?._id;
      socket?.emit('messageDeleted', { messageId, receiverId });
    } catch (error) {
      console.error('Error deleting message:', error);
      if (error.response?.status === 403) {
        alert('You can only delete messages within 15 minutes of sending.');
      } else {
        alert('Failed to delete message');
      }
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

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>💬 Chat App</h2>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
        
        <div className="search-box">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="users-list">
            {searchResults.map((u) => (
              <div 
                key={u._id} 
                className="user-item"
                onClick={() => startConversation(u)}
              >
                <div className="user-avatar">
                  {u.username[0].toUpperCase()}
                </div>
                <div className="conversation-info">
                  <h4>{u.username}</h4>
                  <p>{u.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Conversations List */}
        {searchResults.length === 0 && (
          <div className="conversations-list">
            {conversations.map((conv) => {
              const otherUser = getOtherUser(conv);
              const isOnline = onlineUsers.includes(otherUser?._id);
              
              return (
                <div
                  key={conv._id}
                  className={`conversation-item ${currentChat?._id === conv._id ? 'active' : ''}`}
                  onClick={() => setCurrentChat(conv)}
                >
                  <div className="user-avatar" style={{ position: 'relative' }}>
                    {otherUser?.username?.[0]?.toUpperCase() || '?'}
                    {isOnline && <span className="online-indicator"></span>}
                  </div>
                  <div className="conversation-info">
                    <h4>{otherUser?.username || 'Unknown'}</h4>
                    <p>{conv.lastMessage?.text || 'No messages yet'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        {currentChat ? (
          <>
            <div className="chat-header">
              <div className="user-avatar">
                {getOtherUser(currentChat)?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="chat-header-info">
                <h3>{getOtherUser(currentChat)?.username || 'Unknown'}</h3>
                {typingUser === getOtherUser(currentChat)?._id ? (
                  <p className="typing-indicator">typing...</p>
                ) : (
                  <p>{onlineUsers.includes(getOtherUser(currentChat)?._id) ? 'Online' : 'Offline'}</p>
                )}
              </div>
            </div>

            <div className="messages-container">
              {messages.map((msg, index) => (
                <div 
                  key={msg._id || index} 
                  className={`message ${msg.sender?._id === user._id ? 'own' : ''}`}
                >
                  <div className="message-content">
                    {msg.replyTo && (
                      <div className="reply-preview-inline">
                        <span className="reply-author">{msg.replyTo?.sender?.username || msg.replyTo?.senderName || 'Unknown'}</span>
                        <p className="reply-text">{msg.replyTo?.text || ''}</p>
                      </div>
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

            <form className="message-input-container" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={handleTyping}
              />
              <button type="submit" className="send-btn" disabled={!newMessage.trim()}>
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="no-chat-selected">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
            <h3>Welcome, {user?.username}!</h3>
            <p>Select a conversation or search for users to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
