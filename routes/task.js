const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Staff = require('../models/Staff');
const authenticate = require('../middleware/authenticate');

// ✅ Employee: Add a task
router.post('/', authenticate, async (req, res) => {
  try {
    const { project, title, description } = req.body;

    if (!project || !title || !description) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const staff = await Staff.findOne({ employee_id: req.user.employee_id });
    if (!staff) return res.status(404).json({ message: 'Employee not found' });

    const task = await Task.create({
      employee_id: staff.employee_id,
      employee_ref: staff._id,
      project,
      title,
      description,
      status: 'Pending'
    });

    res.json(task);
  } catch (err) {
    console.error('Error adding task:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Employee: Update status (automatically record start_date and end_date)
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const staff = await Staff.findOne({ employee_id: req.user.employee_id });
    if (!staff) return res.status(404).json({ message: 'Employee not found' });

    const task = await Task.findOne({ _id: req.params.id, employee_ref: staff._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (task.status === 'Completed') {
      return res.status(400).json({ message: 'Task already completed and locked' });
    }

    if (status === 'In Progress' && !task.start_date) task.start_date = new Date();
    if (status === 'Completed') {
      task.end_date = new Date();
      task.completed_at = new Date();
    }

    task.status = status;
    await task.save();

    res.json(task);
  } catch (err) {
    console.error('Error updating status:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});
// ✅ Employee: Get their own tasks
router.get('/', authenticate, async (req, res) => {
  try {
    const staff = await Staff.findOne({ employee_id: req.user.employee_id });
    if (!staff) return res.status(404).json({ message: 'Employee not found' });

    const tasks = await Task.find({ employee_ref: staff._id }).sort({ created_at: -1 });

    res.json(tasks);
  } catch (err) {
    console.error('Error fetching employee tasks:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Admin: Get all tasks
router.get('/all', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });

  try {
    const tasks = await Task.find()
      .populate('employee_ref', 'name employee_id')
      .sort({ created_at: -1 });

    res.json(tasks);
  } catch (err) {
    console.error('Error fetching all tasks:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Admin: Delete a task
router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only' });
  }

  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    await Task.deleteOne({ _id: req.params.id });
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
// ✅ Allow admin to assign task to any employee
router.post('/', authenticate, async (req, res) => {
  try {
    const { project, title, description, employee_id, end_date, priority } = req.body;

    if (!project || !title || !description || !employee_id) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // If admin, use employee_id from body; if employee, use their own.
    let targetEmployeeId = employee_id;
    if (req.user.role !== 'admin') {
      targetEmployeeId = req.user.employee_id;
    }

    const staff = await Staff.findOne({ employee_id: targetEmployeeId });
    if (!staff) return res.status(404).json({ message: 'Employee not found' });

    const task = await Task.create({
      employee_id: staff.employee_id,
      employee_ref: staff._id,
      project,
      title,
      description,
      end_date: end_date ? new Date(end_date) : undefined,
      priority: priority || 'Medium',
      status: 'Pending'
    });

    res.json(task);
  } catch (err) {
    console.error('Error adding task:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});
