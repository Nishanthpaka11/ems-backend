const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Staff = require('../models/Staff');
const sendOTP = require('../utils/mailer'); // Resend-based mailer

// In-memory OTP store (email -> { otp, expiresAt })
const otpStore = new Map();

// 🔑 Normalize IP utility
const normalizeIP = (ip = '') =>
  ip.replace('::ffff:', '').replace('::1', '127.0.0.1').trim();

/* ===================== LOGIN ===================== */
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
    console.error('❌ Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ===================== REQUEST OTP ===================== */
router.post('/request-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const user = await Staff.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    await sendOTP(email, otp); // 🔥 Resend (HTTPS, Render-safe)

    res.json({ message: 'OTP sent to your email' });

  } catch (err) {
    console.error('❌ OTP send error:', err);

    // 🔥 important: external email service failure
    res.status(503).json({
      message: 'Email service unavailable. Please try again.',
    });
  }
});

/* ===================== VERIFY OTP & CHANGE PASSWORD ===================== */
router.post('/verify-otp-change-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const record = otpStore.get(email);

  if (!record || record.otp !== otp || record.expiresAt < Date.now()) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await Staff.findOneAndUpdate({ email }, { password: hashedPassword });

    otpStore.delete(email); // cleanup

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('❌ Password change error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;