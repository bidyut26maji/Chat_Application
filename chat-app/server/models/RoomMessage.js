const mongoose = require('mongoose');

const roomMessageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomMessage',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('RoomMessage', roomMessageSchema);
