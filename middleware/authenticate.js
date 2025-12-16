const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');
require('dotenv').config();

module.exports = async (req, res, next) => {
  try {
    const authHeader =
      req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: Token missing' });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error('❌ JWT Verification Failed:', err.message);
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    const staff = await Staff.findById(decoded.id).select(
      '_id employee_id name email role'
    );

    if (!staff) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    req.user = {
      _id: staff._id,
      id: staff._id.toString(),
      employee_id: staff.employee_id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
    };

    next();
  } catch (err) {
    console.error('❌ Auth Middleware Error:', err.message);
    res.status(500).json({ message: 'Authentication failed' });
  }
};
