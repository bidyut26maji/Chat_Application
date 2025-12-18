import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

const MyRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/rooms/my-rooms`);
        setRooms(res.data);
      } catch (error) {
        console.error('Error fetching rooms:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, []);

  const handleJoinRoom = (room) => {
    navigate(`/room/${room._id}`, { state: { room } });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="my-rooms-container">
      <div className="my-rooms-header">
        <h1>📋 My Rooms</h1>
        <div className="header-buttons">
          <button onClick={() => navigate('/rooms')} className="back-btn">
            ← Back
          </button>
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading rooms...</div>
      ) : rooms.length === 0 ? (
        <div className="no-rooms">
          <p>You haven't joined any rooms yet.</p>
          <button onClick={() => navigate('/rooms')} className="create-room-btn">
            Create or Join a Room
          </button>
        </div>
      ) : (
        <div className="rooms-grid">
          {rooms.map((room) => (
            <div key={room._id} className="room-card">
              <div className="room-card-header">
                <h3>{room.name}</h3>
                {room.isPrivate && <span className="private-badge">🔒 Private</span>}
              </div>
              <p className="room-number">Room #{room.roomNumber}</p>
              {room.description && <p className="room-desc">{room.description}</p>}
              <div className="room-meta">
                <span>Created by: {room.createdBy?.username}</span>
                <span>Members: {room.participants?.length || 0}</span>
              </div>
              <p className="room-date">Joined: {formatDate(room.createdAt)}</p>
              <button 
                onClick={() => handleJoinRoom(room)} 
                className="enter-room-btn"
              >
                Enter Room
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyRooms;
