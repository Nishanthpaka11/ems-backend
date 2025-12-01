const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Staff = require('../models/Staff');
const sendOTP = require('../utils/mailer'); // ✅ updated file name

// In-memory OTP store — replace with DB/Redis in production
const otpStore = new Map();

// 🔑 Normalize IP utility
const normalizeIP = (ip = '') =>
  ip.replace('::ffff:', '').replace('::1', '127.0.0.1').trim();

// ✅ LOGIN ROUTE
router.post('/login', async (req, res) => {
  const { employee_id, password } = req.body;

  try {
    const user = await Staff.findOne({ employee_id });
    if (!user) return res.status(401).json({ message: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Incorrect password' });

    const rawHeader = req.headers['x-forwarded-for'] || '';
    const rawIP = rawHeader.split(',')[0].trim() || req.socket.remoteAddress || '';
    const clientIP = normalizeIP(rawIP);

    const token = jwt.sign(
      { id: user._id, employee_id: user.employee_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        employee_id: user.employee_id,
        name: user.name,
        role: user.role,
      },
      clientIP,
    });
  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ REQUEST OTP (for password reset)
router.post('/request-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const user = await Staff.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, otp);

    await sendOTP(email, otp); // ✅ using mailer.js
    console.log(`📩 OTP sent to ${email}: ${otp}`);

    res.json({ message: 'OTP sent to your email' });
  } catch (err) {
    console.error('❌ OTP send error:', err.message);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// ✅ VERIFY OTP & CHANGE PASSWORD
router.post('/verify-otp-change-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const storedOtp = otpStore.get(email);
  if (!storedOtp || storedOtp !== otp) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await Staff.findOneAndUpdate({ email }, { password: hashedPassword });

    otpStore.delete(email);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('❌ Password change error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
