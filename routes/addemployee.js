const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const authenticate = require('../middleware/authenticate');
const Staff = require('../models/Staff');

// ========================================
// MIDDLEWARE: Check if user is admin
// ========================================
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  next();
};

// ========================================
// ADD NEW EMPLOYEE
// ========================================
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const {
      employee_id,
      name,
      email,
      password,
      phone,
      role,
      department,
      position,
      currentAddress,
      permanentAddress,
      aadhar,
      leave_quota,
      dob                // 🔹 DOB coming from frontend (YYYY-MM-DD)
    } = req.body;

    // Validation
    if (!employee_id || !name || !email || !password) {
      return res.status(400).json({
        message: 'Employee ID, name, email, and password are required'
      });
    }

    // Check if employee_id already exists
    const existingEmployeeId = await Staff.findOne({ employee_id });
    if (existingEmployeeId) {
      return res.status(400).json({
        message: 'Employee ID already exists'
      });
    }

    // Check if email already exists
    const existingEmail = await Staff.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        message: 'Email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new employee
    const newEmployee = new Staff({
      employee_id,
      name,
      email,
      password: hashedPassword,
      phone: phone || '',
      role: role || 'employee',
      department: department || 'IT',
      position: position || '',
      currentAddress: currentAddress || '',
      permanentAddress: permanentAddress || '',
      aadhar: aadhar || null,
      leave_quota: leave_quota || 12,
      photo: null,
      dob: dob ? new Date(dob) : null      // 🔹 save DOB into schema
    });

    await newEmployee.save();

    console.log('New employee created:', newEmployee.employee_id);

    res.status(201).json({
      message: 'Employee added successfully',
      employee: {
        _id: newEmployee._id,
        employee_id: newEmployee.employee_id,
        name: newEmployee.name,
        email: newEmployee.email,
        role: newEmployee.role,
        department: newEmployee.department,
        position: newEmployee.position,
        dob: newEmployee.dob               // 🔹 optionally return dob too
      }
    });
  } catch (err) {
    console.error('Error adding employee:', err.message);
    res.status(500).json({ 
      message: 'Server error: ' + err.message 
    });
  }
});

// ========================================
// GET ALL EMPLOYEES
// ========================================
router.get('/all', authenticate, isAdmin, async (req, res) => {
  try {
    const employees = await Staff.find().select('-password');

    // Convert photo paths to full URLs
    const employeesWithPhotos = employees.map(emp => {
      const empObj = emp.toObject();
      if (empObj.photo) {
        empObj.photo = `${req.protocol}://${req.get('host')}${empObj.photo}`;
      }
      return empObj;
    });

    res.json(employeesWithPhotos);
  } catch (err) {
    console.error('Error fetching employees:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========================================
// GET SINGLE EMPLOYEE BY ID
// ========================================
router.get('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    // Validate MongoDB ObjectId format
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid employee ID format' });
    }

    const employee = await Staff.findById(req.params.id).select('-password');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Convert photo path to full URL
    const empObj = employee.toObject();
    if (empObj.photo) {
      empObj.photo = `${req.protocol}://${req.get('host')}${empObj.photo}`;
    }

    res.json(empObj);
  } catch (err) {
    console.error('Error fetching employee:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========================================
// UPDATE EMPLOYEE
// ========================================
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      role,
      department,
      position,
      currentAddress,
      permanentAddress,
      aadhar,
      leave_quota,
      dob                     // 🔹 allow updating DOB
    } = req.body;

    // Check if email is being changed and if it already exists
    if (email) {
      const existingEmail = await Staff.findOne({ 
        email, 
        _id: { $ne: req.params.id } 
      });
      
      if (existingEmail) {
        return res.status(400).json({ 
          message: 'Email already exists' 
        });
      }
    }

    // Build update payload
    const updatePayload = {
      name,
      email,
      phone,
      role,
      department,
      position,
      currentAddress,
      permanentAddress,
      aadhar,
      leave_quota
    };

    // Only set dob if it is provided in request
    if (typeof dob !== 'undefined') {
      updatePayload.dob = dob ? new Date(dob) : null;   // 🔹 update DOB
    }

    // Update employee
    const updatedEmployee = await Staff.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Convert photo path to full URL
    const empObj = updatedEmployee.toObject();
    if (empObj.photo) {
      empObj.photo = `${req.protocol}://${req.get('host')}${empObj.photo}`;
    }

    res.json({
      message: 'Employee updated successfully',
      employee: empObj
    });
  } catch (err) {
    console.error('Error updating employee:', err.message);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// ========================================
// DELETE EMPLOYEE
// ========================================
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const employee = await Staff.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Delete photo file if exists
    if (employee.photo) {
      const path = require('path');
      const fs = require('fs');
      const photoPath = path.join(__dirname, '..', employee.photo);
      
      if (fs.existsSync(photoPath)) {
        try {
          fs.unlinkSync(photoPath);
          console.log('Photo deleted:', photoPath);
        } catch (err) {
          console.error('Error deleting photo file:', err.message);
        }
      }
    }

    await Staff.findByIdAndDelete(req.params.id);

    res.json({ 
      message: 'Employee deleted successfully' 
    });
  } catch (err) {
    console.error('Error deleting employee:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========================================
// RESET EMPLOYEE PASSWORD
// ========================================
router.put('/:id/reset-password', authenticate, isAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const employee = await Staff.findByIdAndUpdate(
      req.params.id,
      { password: hashedPassword },
      { new: true }
    ).select('employee_id name email');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({
      message: 'Password reset successfully',
      employee
    });
  } catch (err) {
    console.error('Error resetting password:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========================================
// GET EMPLOYEE STATISTICS
// ========================================
router.get('/stats/overview', authenticate, isAdmin, async (req, res) => {
  try {
    const totalEmployees = await Staff.countDocuments({ role: 'employee' });
    const totalAdmins = await Staff.countDocuments({ role: 'admin' });
    const departments = await Staff.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);

    res.json({
      totalEmployees,
      totalAdmins,
      totalStaff: totalEmployees + totalAdmins,
      departments
    });
  } catch (err) {
    console.error('Error fetching statistics:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========================================
// SEARCH EMPLOYEES
// ========================================
router.get('/search/query', authenticate, isAdmin, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const employees = await Staff.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { employee_id: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { department: { $regex: q, $options: 'i' } },
        { position: { $regex: q, $options: 'i' } }
      ]
    }).select('-password');

    // Convert photo paths to full URLs
    const employeesWithPhotos = employees.map(emp => {
      const empObj = emp.toObject();
      if (empObj.photo) {
        empObj.photo = `${req.protocol}://${req.get('host')}${empObj.photo}`;
      }
      return empObj;
    });

    res.json(employeesWithPhotos);
  } catch (err) {
    console.error('Error searching employees:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
