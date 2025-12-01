const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Parser } = require('json2csv');
const { countWeekdaysInMonth } = require('../utils/datehelper');

const authenticate = require('../middleware/authenticate');
const checkOfficeIP = require('../middleware/checkOfficeIP');
const Attendance = require('../models/Attendance');
const Staff = require('../models/Staff');
const Task = require('../models/Task'); // ✅ New model for tasks

// ================= Multer setup =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = `photo-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// Normalize IP
const normalizeIP = (ip = '') =>
  ip.replace(/\s+/g, '').replace('::ffff:', '').replace('::1', '127.0.0.1');

// ================= Attendance Routes =================

// ✅ Punch In / Out
router.post('/punch', authenticate, upload.single('photo'), checkOfficeIP, async (req, res) => {
  const empId = req.user._id;
  const empCode = req.user.employee_id;
  const now = new Date();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const forwarded = req.headers['x-forwarded-for'] || '';
  const remote = req.socket.remoteAddress || '';
  const localIPFromClient = req.body?.localIP || '';
  const primaryIP = normalizeIP(forwarded.split(',')[0] || remote);
  const normalizedLocalIP = normalizeIP(localIPFromClient);
  const photoPath = req.file?.path?.replace(/\\/g, '/') || '';

  try {
    let record = await Attendance.findOne({
      employee_ref: empId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (!record) {
      if (!photoPath) {
        return res.status(400).json({ message: 'Photo is required for Punch In.' });
      }

      await Attendance.create({
        employee_ref: empId,
        employee_id: empCode,
        date: now,
        punch_in_time: now,
        ip: primaryIP,
        photo_path: photoPath,
      });

      return res.json({ message: '✅ Punch In successful', type: 'in' });
    }

    if (!record.punch_out_time) {
      const diffInHours = (now - new Date(record.punch_in_time)) / (1000 * 60 * 60);
      if (diffInHours < 1) {
        return res.status(400).json({
          message: '⚠️ You can only punch out after 1 hour from punch in.',
        });
      }

      record.punch_out_time = now;
      record.ip = primaryIP;
      if (photoPath) record.photo_path = photoPath;
      await record.save();

      return res.json({ message: '✅ Punch Out successful', type: 'out' });
    }

    return res.status(400).json({ message: '⚠️ Already punched in and out today.' });
  } catch (err) {
    console.error('❌ Punch error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ✅ Status Check
router.get('/status', authenticate, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const record = await Attendance.findOne({
      employee_ref: req.user._id,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    res.json({
      punch_in: record?.punch_in_time || null,
      punch_out: record?.punch_out_time || null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Unable to fetch punch status' });
  }
});

// ✅ CSV Export
router.get('/export', authenticate, async (req, res) => {
  try {
    const records = await Attendance.find({});
    if (!records.length) return res.status(404).json({ message: 'No attendance records found' });

    const data = records.map(r => ({
      id: r._id,
      employee_id: r.employee_id || 'N/A',
      date: r.date,
      punch_in: r.punch_in_time,
      punch_out: r.punch_out_time,
      ip: r.ip || '',
    }));

    const csv = new Parser().parse(data);
    res.header('Content-Type', 'text/csv').attachment('attendance.csv').send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate CSV' });
  }
});

// ✅ Admin: View Attendance Records
router.get('/attendance-records', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only' });
  }

  try {
    const records = await Attendance.find({})
      .populate({ path: 'employee_ref', select: 'name employee_id', strictPopulate: false })
      .sort({ date: -1 });

    const data = records.map(r => ({
      id: r._id,
      employee_id: r.employee_id || r.employee_ref?.employee_id || 'N/A',
      employee_name: r.employee_ref?.name || 'N/A',
      ip: r.ip || '',
      date: r.date,
      punch_in_time: r.punch_in_time || '',
      punch_out_time: r.punch_out_time || '',
      photo_path: r.photo_path || '',
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch attendance records' });
  }
});

// ✅ Admin: View Photo
router.get('/photo/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only' });
  }

  try {
    const record = await Attendance.findById(req.params.id);
    if (!record?.photo_path) return res.status(404).json({ message: 'Photo not found' });

    const fullPath = path.join(__dirname, '..', record.photo_path);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ message: 'File missing' });

    res.sendFile(fullPath);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch photo' });
  }
});

// ✅ Monthly Summary
router.get('/monthly-summary', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only' });
  }

  try {
    const records = await Attendance.aggregate([
      {
        $match: {
          punch_in_time: { $exists: true },
          punch_out_time: { $exists: true },
          date: { $type: "date" }
        }
      },
      {
        $group: {
          _id: {
            employee_id: "$employee_id",
            year: { $year: "$date" },
            month: { $month: "$date" }
          },
          present_days: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "staff",
          localField: "_id.employee_id",
          foreignField: "employee_id",
          as: "employee"
        }
      },
      { $unwind: "$employee" }
    ]);

    const summary = records.map(item => {
      const { employee_id, year, month } = item._id;
      const totalWorkingDays = countWeekdaysInMonth(year, month - 1);
      return {
        employee_id,
        employee_name: item.employee.name,
        month: `${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`,
        present_days: item.present_days,
        total_working_days: totalWorkingDays,
      };
    });

    res.json(summary);
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ message: 'Failed to calculate summary' });
  }
});

// ✅ Admin: Dashboard Summary
router.get('/admin-dashboard-summary', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only' });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalEmployees = await Staff.countDocuments({});
    const punchInCount = await Attendance.countDocuments({
      date: today,
      punch_in_time: { $exists: true },
    });
    const punchOutCount = await Attendance.countDocuments({
      date: today,
      punch_out_time: { $exists: true },
    });

    res.json({
      totalEmployees,
      punchInCount,
      punchOutCount,
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard summary' });
  }
});

// ================= Task Routes =================

// ✅ Employee: Add Task
router.post('/tasks', authenticate, async (req, res) => {
  try {
    const { project, title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    const task = new Task({
      employee_ref: req.user._id,
      employee_id: req.user.employee_id,
      project,
      title,
      description,
      created_at: new Date(),
    });

    await task.save();
    res.json({ message: '✅ Task added successfully', task });
  } catch (err) {
    console.error('Task add error:', err);
    res.status(500).json({ message: 'Failed to add task' });
  }
});

// ✅ Employee: View My Tasks
router.get('/tasks/my', authenticate, async (req, res) => {
  try {
    const tasks = await Task.find({ employee_ref: req.user._id }).sort({ created_at: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch tasks' });
  }
});

// ✅ Admin: View All Tasks
router.get('/tasks', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only' });
  }

  try {
    const tasks = await Task.find({})
      .populate({ path: 'employee_ref', select: 'name employee_id', strictPopulate: false })
      .sort({ created_at: -1 });

    const formatted = tasks.map(t => ({
      id: t._id,
      project: t.project || '',
      title: t.title,
      description: t.description,
      employee_name: t.employee_ref?.name || 'N/A',
      employee_id: t.employee_ref?.employee_id || t.employee_id,
      created_at: t.created_at,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch all tasks' });
  }
});

module.exports = router;
