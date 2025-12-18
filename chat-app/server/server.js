const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const roomRoutes = require('./routes/rooms');

const app = express();
const server = http.createServer(app);

// Configure CORS for production
const allowedOrigins = process.env.CLIENT_URL 
  ? [process.env.CLIENT_URL, "http://localhost:3000"]
  : ["http://localhost:3000"];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);

// Socket.io connection handling
const onlineUsers = new Map();
const roomUsers = new Map(); // Track users in each room

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('addUser', (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit('getUsers', Array.from(onlineUsers.keys()));
  });

  // Room events
  socket.on('joinRoom', ({ roomId, userId, username }) => {
    socket.join(roomId);
    
    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, new Map());
    }
    roomUsers.get(roomId).set(userId, { odataId: socket.id, username });
    
    // Notify room members
    socket.to(roomId).emit('userJoinedRoom', { userId, username });
    
    // Send current room users
    const users = Array.from(roomUsers.get(roomId).entries()).map(([id, data]) => ({
      odataId: id,
      username: data.username
    }));
    io.to(roomId).emit('roomUsers', { roomId, users });
  });

  socket.on('leaveRoom', ({ roomId, userId, username }) => {
    socket.leave(roomId);
    
    if (roomUsers.has(roomId)) {
      roomUsers.get(roomId).delete(userId);
      if (roomUsers.get(roomId).size === 0) {
        roomUsers.delete(roomId);
      }
    }
    
    socket.to(roomId).emit('userLeftRoom', { userId, username });
    
    // Send updated room users
    if (roomUsers.has(roomId)) {
      const users = Array.from(roomUsers.get(roomId).entries()).map(([id, data]) => ({
        odataId: id,
        username: data.username
      }));
      io.to(roomId).emit('roomUsers', { roomId, users });
    }
  });

  socket.on('sendRoomMessage', ({ roomId, senderId, senderName, text, messageId, createdAt, replyTo }) => {
    io.to(roomId).emit('roomMessage', {
      senderId,
      senderName,
      text,
      messageId,
      createdAt: createdAt || new Date(),
      replyTo: replyTo || null
    });
  });

  socket.on('roomTyping', ({ roomId, userId, username }) => {
    socket.to(roomId).emit('userTypingInRoom', { userId, username });
  });

  socket.on('roomStopTyping', ({ roomId, userId }) => {
    socket.to(roomId).emit('userStoppedTypingInRoom', { userId });
  });

  // Room message deleted
  socket.on('roomMessageDeleted', ({ roomId, messageId }) => {
    socket.to(roomId).emit('roomMessageDeleted', { messageId });
  });

  // Direct message events
  socket.on('sendMessage', ({ senderId, senderName, receiverId, text, messageId, createdAt, replyTo }) => {
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('getMessage', {
        senderId,
        senderName,
        text,
        messageId,
        createdAt: createdAt || new Date(),
        replyTo: replyTo || null
      });
    }
  });

  // Direct message deleted
  socket.on('messageDeleted', ({ messageId, receiverId }) => {
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('messageDeleted', { messageId });
    }
  });

  socket.on('typing', ({ senderId, receiverId }) => {
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('userTyping', { senderId });
    }
  });

  socket.on('stopTyping', ({ senderId, receiverId }) => {
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('userStoppedTyping', { senderId });
    }
  });

  socket.on('disconnect', () => {
    // Remove from online users
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        
        // Remove from all rooms
        for (let [roomId, users] of roomUsers.entries()) {
          if (users.has(userId)) {
            const userData = users.get(userId);
            users.delete(userId);
            socket.to(roomId).emit('userLeftRoom', { userId, username: userData.username });
            
            // Send updated room users
            const remainingUsers = Array.from(users.entries()).map(([id, data]) => ({
              odataId: id,
              username: data.username
            }));
            io.to(roomId).emit('roomUsers', { roomId, users: remainingUsers });
          }
        }
        break;
      }
    }
    io.emit('getUsers', Array.from(onlineUsers.keys()));
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
