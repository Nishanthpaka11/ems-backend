const mongoose = require('mongoose');

const AttendanceOverrideSchema = new mongoose.Schema({
  employee_id: { type: String, required: true },
  month: { type: String, required: true }, // e.g., "August 2025"
  present_days: { type: Number, required: true },
}, { collection: 'attendance_overrides' });

module.exports = mongoose.model('AttendanceOverride', AttendanceOverrideSchema);
