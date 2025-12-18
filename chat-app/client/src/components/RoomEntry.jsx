import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../config';

const RoomEntry = () => {
  const [mode, setMode] = useState('join'); // 'join', 'create', or 'browse'
  const [roomNumber, setRoomNumber] = useState('');
  const [roomName, setRoomName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [publicRooms, setPublicRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const { logout } = useAuth();
  const navigate = useNavigate();

  // Fetch public rooms when browse mode is selected
  useEffect(() => {
    if (mode === 'browse') {
      fetchPublicRooms();
    }
  }, [mode]);

  const fetchPublicRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await axios.get(`${API_URL}/api/rooms/public`);
      setPublicRooms(res.data);
    } catch (err) {
      console.error('Error fetching public rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleJoinPublicRoom = async (room) => {
    try {
      const res = await axios.post(`${API_URL}/api/rooms/join`, {
        roomNumber: room.roomNumber,
        password: ''
      });
      navigate(`/room/${res.data.room._id}`, { 
        state: { room: res.data.room } 
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join room');
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/rooms/join`, {
        roomNumber,
        password
      });
      
      navigate(`/room/${res.data.room._id}`, { 
        state: { room: res.data.room } 
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/rooms/create`, {
        roomNumber,
        name: roomName,
        description,
        isPrivate,
        password: isPrivate ? password : ''
      });
      
      // After creating, join the room
      const joinRes = await axios.post(`${API_URL}/api/rooms/join`, {
        roomNumber,
        password: isPrivate ? password : ''
      });
      
      navigate(`/room/${joinRes.data.room._id}`, { 
        state: { room: joinRes.data.room } 
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const generateRoomNumber = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    setRoomNumber(randomNum.toString());
  };

  return (
    <div className="room-entry-container">
      <div className="room-entry-card">
        <div className="room-entry-header">
          <h1>💬 Chat Rooms</h1>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>

        <div className="room-tabs">
          <button 
            className={`tab-btn ${mode === 'browse' ? 'active' : ''}`}
            onClick={() => setMode('browse')}
          >
            Browse Rooms
          </button>
          <button 
            className={`tab-btn ${mode === 'join' ? 'active' : ''}`}
            onClick={() => setMode('join')}
          >
            Join Room
          </button>
          <button 
            className={`tab-btn ${mode === 'create' ? 'active' : ''}`}
            onClick={() => setMode('create')}
          >
            Create Room
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {mode === 'browse' ? (
          <div className="public-rooms-list">
            <h3>🌐 Public Rooms</h3>
            {loadingRooms ? (
              <p>Loading rooms...</p>
            ) : publicRooms.length === 0 ? (
              <p className="no-rooms">No public rooms available. Create one!</p>
            ) : (
              <div className="rooms-grid">
                {publicRooms.map((room) => (
                  <div key={room._id} className="room-card">
                    <div className="room-card-header">
                      <h4>{room.name}</h4>
                      <span className="room-number">#{room.roomNumber}</span>
                    </div>
                    {room.description && <p className="room-description">{room.description}</p>}
                    <div className="room-card-footer">
                      <span className="room-creator">by {room.createdBy?.username}</span>
                      <span className="room-participants">{room.participants?.length || 0} members</span>
                    </div>
                    <button 
                      className="join-room-btn"
                      onClick={() => handleJoinPublicRoom(room)}
                    >
                      Join Room
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : mode === 'join' ? (
          <form onSubmit={handleJoinRoom} className="room-form">
            <div className="form-group">
              <label>Room Number</label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="Enter room number"
                required
              />
            </div>

            <div className="form-group">
              <label>Password (if private room)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter room password (optional)"
              />
            </div>

            <button type="submit" className="room-btn" disabled={loading}>
              {loading ? 'Joining...' : 'Join Room'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreateRoom} className="room-form">
            <div className="form-group">
              <label>Room Number</label>
              <div className="input-with-button">
                <input
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="Enter room number"
                  required
                />
                <button type="button" onClick={generateRoomNumber} className="generate-btn">
                  Generate
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Room Name</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Enter room name"
                required
              />
            </div>

            <div className="form-group">
              <label>Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this room about?"
              />
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                />
                Private Room (requires password)
              </label>
            </div>

            {isPrivate && (
              <div className="form-group">
                <label>Room Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Set room password"
                  required={isPrivate}
                />
              </div>
            )}

            <button type="submit" className="room-btn" disabled={loading}>
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </form>
        )}

        <div className="room-links">
          <button onClick={() => navigate('/my-rooms')} className="link-btn">
            📋 My Rooms
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoomEntry;
