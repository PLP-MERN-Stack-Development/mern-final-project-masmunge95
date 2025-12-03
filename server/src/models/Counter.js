const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  sequence_value: {
    type: Number,
    default: 0, // Start from 0 so first increment yields 1 per seller
  },
});

module.exports = mongoose.model('Counter', counterSchema);