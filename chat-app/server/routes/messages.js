const express = require('express');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const auth = require('../middleware/auth');

const router = express.Router();

// Get or create conversation
router.post('/conversation', auth, async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user._id;

    // Check if conversation exists
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, receiverId]
      });
      await conversation.save();
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    })
      .populate('participants', 'username avatar status')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Send message
router.post('/', auth, async (req, res) => {
  try {
    const { conversationId, text, replyTo } = req.body;

    const message = new Message({
      conversationId,
      sender: req.user._id,
      text,
      replyTo: replyTo || null
    });
    await message.save();

    // Update conversation's last message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id
    });

    const populatedMessage = await Message.findById(message._id)
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

// Get messages for a conversation
router.get('/:conversationId', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      conversationId: req.params.conversationId
    })
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

// Mark messages as read
router.put('/read/:conversationId', auth, async (req, res) => {
  try {
    await Message.updateMany(
      {
        conversationId: req.params.conversationId,
        sender: { $ne: req.user._id },
        read: false
      },
      { read: true }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a message (only within 15 minutes)
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    
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

    await Message.findByIdAndDelete(req.params.messageId);

    res.json({ message: 'Message deleted successfully', messageId: req.params.messageId });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
