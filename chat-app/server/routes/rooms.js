const express = require('express');
const Room = require('../models/Room');
const RoomMessage = require('../models/RoomMessage');
const auth = require('../middleware/auth');

const router = express.Router();

// Create a new room
router.post('/create', auth, async (req, res) => {
  try {
    const { roomNumber, name, description, isPrivate, password } = req.body;

    // Check if room number already exists
    const existingRoom = await Room.findOne({ roomNumber });
    if (existingRoom) {
      return res.status(400).json({ message: 'Room number already exists' });
    }

    const room = new Room({
      roomNumber,
      name,
      description,
      createdBy: req.user._id,
      participants: [req.user._id],
      isPrivate,
      password: isPrivate ? password : ''
    });

    await room.save();

    res.status(201).json({
      message: 'Room created successfully',
      room: {
        _id: room._id,
        roomNumber: room.roomNumber,
        name: room.name,
        description: room.description,
        isPrivate: room.isPrivate,
        participantsCount: room.participants.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Join a room by room number
router.post('/join', auth, async (req, res) => {
  try {
    const { roomNumber, password } = req.body;

    const room = await Room.findOne({ roomNumber }).populate('participants', 'username avatar');
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check password for private rooms
    if (room.isPrivate && room.password !== password) {
      return res.status(401).json({ message: 'Incorrect room password' });
    }

    // Add user to participants if not already there
    if (!room.participants.some(p => p._id.toString() === req.user._id.toString())) {
      room.participants.push(req.user._id);
      await room.save();
    }

    const updatedRoom = await Room.findById(room._id).populate('participants', 'username avatar');

    res.json({
      message: 'Joined room successfully',
      room: updatedRoom
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get room by room number
router.get('/number/:roomNumber', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ roomNumber: req.params.roomNumber })
      .populate('participants', 'username avatar')
      .populate('createdBy', 'username');

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json(room);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all public rooms
router.get('/public', auth, async (req, res) => {
  try {
    const rooms = await Room.find({ isPrivate: false })
      .populate('createdBy', 'username')
      .sort({ updatedAt: -1 });

    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's rooms
router.get('/my-rooms', auth, async (req, res) => {
  try {
    const rooms = await Room.find({
      participants: req.user._id
    })
      .populate('createdBy', 'username')
      .sort({ updatedAt: -1 });

    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get room messages
router.get('/:roomId/messages', auth, async (req, res) => {
  try {
    const messages = await RoomMessage.find({ roomId: req.params.roomId })
      .populate('sender', 'username avatar')
      .populate('replyTo', 'text sender')
      .populate({
        path: 'replyTo',
        populate: {
          path: 'sender',
          select: 'username'
        }
      })
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Send message to room
router.post('/:roomId/messages', auth, async (req, res) => {
  try {
    const { text, replyTo } = req.body;

    const message = new RoomMessage({
      roomId: req.params.roomId,
      sender: req.user._id,
      text,
      replyTo: replyTo || null
    });

    await message.save();

    const populatedMessage = await RoomMessage.findById(message._id)
      .populate('sender', 'username avatar')
      .populate('replyTo', 'text sender')
      .populate({
        path: 'replyTo',
        populate: {
          path: 'sender',
          select: 'username'
        }
      });

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Leave room
router.post('/:roomId/leave', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    room.participants = room.participants.filter(
      p => p.toString() !== req.user._id.toString()
    );
    
    await room.save();

    res.json({ message: 'Left room successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get room participants
router.get('/:roomId/participants', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId)
      .populate('participants', 'username avatar status');

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json(room.participants);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a room message (only within 15 minutes)
router.delete('/:roomId/messages/:messageId', auth, async (req, res) => {
  try {
    const message = await RoomMessage.findById(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only sender can delete their message
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    // Check if message is within 15 minutes
    const messageTime = new Date(message.createdAt).getTime();
    const currentTime = new Date().getTime();
    const fifteenMinutes = 15 * 60 * 1000;
    
    if ((currentTime - messageTime) > fifteenMinutes) {
      return res.status(403).json({ message: 'You can only delete messages within 15 minutes of sending' });
    }

    await RoomMessage.findByIdAndDelete(req.params.messageId);

    res.json({ 
      message: 'Message deleted successfully', 
      messageId: req.params.messageId,
      roomId: req.params.roomId
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
