const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const profilePhotoUpload = require('../middleware/profilePhotoUpload');
const Staff = require('../models/Staff');
const path = require('path');
const fs = require('fs');

// ✅ GET Profile of the logged-in user
router.get('/', authenticate, async (req, res) => {
  const staffId = req.user.id;

  try {
    const user = await Staff.findById(staffId).select(
      'employee_id name email phone photo role department position currentAddress permanentAddress'
    );

    if (!user) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Convert photo path to full URL if exists
    if (user.photo) {
      user.photo = `${req.protocol}://${req.get('host')}${user.photo}`;
    }

    res.json(user);
  } catch (err) {
    console.error('Error fetching profile:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ UPDATE Profile (name, phone, addresses)
router.put('/', authenticate, async (req, res) => {
  const { name, phone, currentAddress, permanentAddress } = req.body;
  const staffId = req.user.id;

  if (!name) {
    return res.status(400).json({ message: 'Name is required' });
  }

  try {
    const updatedUser = await Staff.findByIdAndUpdate(
      staffId,
      { 
        name, 
        phone: phone || null,
        currentAddress: currentAddress || '',
        permanentAddress: permanentAddress || ''
      },
      { new: true }
    ).select('employee_id name email phone photo currentAddress permanentAddress');

    res.json({ 
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error('Error updating profile:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ UPLOAD Profile Picture
router.post('/upload-photo', authenticate, profilePhotoUpload.single('photo'), async (req, res) => {
  try {
    const staffId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get current user to delete old photo
    const user = await Staff.findById(staffId);
    
    // Delete old photo if exists
    if (user.photo) {
      const oldPhotoPath = path.join(__dirname, '..', user.photo);
      if (fs.existsSync(oldPhotoPath)) {
        try {
          fs.unlinkSync(oldPhotoPath);
          console.log('Old photo deleted:', oldPhotoPath);
        } catch (err) {
          console.error('Error deleting old photo:', err.message);
        }
      }
    }

    // Save new photo path (relative path stored in database)
    const photoPath = `/uploads/profile-photos/${req.file.filename}`;
    await Staff.findByIdAndUpdate(staffId, { photo: photoPath });

    res.json({
      message: 'Photo uploaded successfully',
      photo: `${req.protocol}://${req.get('host')}${photoPath}`
    });
  } catch (err) {
    console.error('Error uploading photo:', err.message);
    
    // Delete uploaded file if database update failed
    if (req.file) {
      const uploadedFilePath = req.file.path;
      if (fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }
    }
    
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// ✅ DELETE Profile Picture
router.delete('/delete-photo', authenticate, async (req, res) => {
  try {
    const staffId = req.user.id;
    const user = await Staff.findById(staffId);

    if (!user.photo) {
      return res.status(404).json({ message: 'No photo to delete' });
    }

    // Delete photo file from file system
    const photoPath = path.join(__dirname, '..', user.photo);
    if (fs.existsSync(photoPath)) {
      try {
        fs.unlinkSync(photoPath);
        console.log('Photo deleted:', photoPath);
      } catch (err) {
        console.error('Error deleting photo file:', err.message);
      }
    }

    // Remove photo reference from database
    await Staff.findByIdAndUpdate(staffId, { photo: null });

    res.json({ message: 'Photo deleted successfully' });
  } catch (err) {
    console.error('Error deleting photo:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ GET all employee profiles (for admin) - MUST BE BEFORE /employee/:id
router.get('/profiles', authenticate, async (req, res) => {
  try {
    // Optional: Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const employees = await Staff.find().select(
      'employee_id name email phone role leave_quota photo department position'
    );

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
    console.error('Error fetching profiles:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ GET single employee details by ID (for admin)
router.get('/employee/:id', authenticate, async (req, res) => {
  try {
    console.log('Fetching employee with ID:', req.params.id); // Debug log

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    // Validate MongoDB ObjectId format
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid employee ID format' });
    }

    const employee = await Staff.findById(req.params.id).select(
      'employee_id name email phone role leave_quota photo department position currentAddress permanentAddress aadhar'
    );

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Convert photo path to full URL
    const empObj = employee.toObject();
    if (empObj.photo) {
      empObj.photo = `${req.protocol}://${req.get('host')}${empObj.photo}`;
    }

    console.log('Employee found:', empObj.name); // Debug log
    res.json(empObj);
  } catch (err) {
    console.error('Error fetching employee details:', err.message);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});
// ✅ UPDATE employee details (for admin)
router.put('/employee/:id', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { name, phone, email, department, position, currentAddress, permanentAddress, aadhar } = req.body;

    const updatedEmployee = await Staff.findByIdAndUpdate(
      req.params.id,
      {
        name,
        phone,
        email,
        department,
        position,
        currentAddress,
        permanentAddress,
        aadhar
      },
      { new: true, runValidators: true }
    ).select('employee_id name email phone role leave_quota photo department position currentAddress permanentAddress aadhar');

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

// ✅ UPLOAD employee photo (for admin)
router.post('/employee/:id/upload-photo', authenticate, profilePhotoUpload.single('photo'), async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get employee to delete old photo
    const employee = await Staff.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Delete old photo if exists
    if (employee.photo) {
      const oldPhotoPath = path.join(__dirname, '..', employee.photo);
      if (fs.existsSync(oldPhotoPath)) {
        try {
          fs.unlinkSync(oldPhotoPath);
          console.log('Old photo deleted:', oldPhotoPath);
        } catch (err) {
          console.error('Error deleting old photo:', err.message);
        }
      }
    }

    // Save new photo path
    const photoPath = `/uploads/profile-photos/${req.file.filename}`;
    await Staff.findByIdAndUpdate(req.params.id, { photo: photoPath });

    res.json({
      message: 'Photo uploaded successfully',
      photo: `${req.protocol}://${req.get('host')}${photoPath}`
    });
  } catch (err) {
    console.error('Error uploading photo:', err.message);
    
    // Delete uploaded file if database update failed
    if (req.file) {
      const uploadedFilePath = req.file.path;
      if (fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }
    }
    
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// ✅ DELETE employee photo (for admin)
router.delete('/employee/:id/delete-photo', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const employee = await Staff.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    if (!employee.photo) {
      return res.status(404).json({ message: 'No photo to delete' });
    }

    // Delete photo file
    const photoPath = path.join(__dirname, '..', employee.photo);
    if (fs.existsSync(photoPath)) {
      try {
        fs.unlinkSync(photoPath);
        console.log('Photo deleted:', photoPath);
      } catch (err) {
        console.error('Error deleting photo file:', err.message);
      }
    }

    // Remove photo from database
    await Staff.findByIdAndUpdate(req.params.id, { photo: null });

    res.json({ message: 'Photo deleted successfully' });
  } catch (err) {
    console.error('Error deleting photo:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
