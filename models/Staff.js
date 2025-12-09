const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  employee_id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'employee'],
    default: 'employee'
  },
  position: {
    type: String,
    default: ''
  },
  photo: {
    type: String,
    default: null
  },

  // 🔹 ADD DATE OF BIRTH HERE
  dob: {
    type: Date,
    default: null
  },

  currentAddress: {
    type: String,
    default: ''
  },
  permanentAddress: {
    type: String,
    default: ''
  },
  department: {
    type: String,
    default: 'IT'
  },
  leave_quota: {
    type: Number,
    default: 12
  },
  aadhar: {
    type: String,
    default: null
  },
}, { collection: 'staff', timestamps: true });

module.exports = mongoose.model('Staff', staffSchema);
