const AdminSettings = require('../models/AdminSettings');

const normalizeIP = (ip = '') =>
  ip.replace(/\s+/g, '').replace('::ffff:', '').replace('::1', '127.0.0.1').trim();

module.exports = async (req, res, next) => {
  try {
    const rawHeader = req.headers['x-forwarded-for'] || '';
    const rawIP = rawHeader || req.socket.remoteAddress || '';
    const forwardedIPs = rawIP.split(',').map(normalizeIP);
    const clientIP = forwardedIPs[0];

    console.log('------------------------------------------');
    console.log(`🔍 Raw x-forwarded-for: ${rawHeader}`);
    console.log(`🔍 Raw IP fallback: ${req.socket.remoteAddress}`);
    console.log(`🔍 Normalized Client IP: ${clientIP}`);

    // Allow localhost in development
    if (forwardedIPs.includes('127.0.0.1')) {
      console.log('🛠 Localhost detected — skipping restriction.');
      req.networkCheck = { clientIP, ipAllowed: true };
      return next();
    }

    const settings = await AdminSettings.findOne();
    if (!settings) {
      return res.status(500).json({ message: 'Admin settings not configured' });
    }

    const allowed_ips = (Array.isArray(settings.allowed_ips)
      ? settings.allowed_ips
      : String(settings.allowed_ips).split(',')
    ).map(normalizeIP).filter(Boolean);

    const ipAllowed = forwardedIPs.some(ip => allowed_ips.includes(ip));

    req.networkCheck = { clientIP, ipAllowed };

    console.log(`✅ Allowed WiFi IPs: ${allowed_ips.join(', ')}`);
    console.log(`✅ Match result: IP Allowed = ${ipAllowed}`);
    console.log('------------------------------------------');

    if (!ipAllowed) {
      return res.status(403).json({
        message: 'Access denied. Not on allowed WiFi.',
        clientIP,
        ipAllowed,
      });
    }

    next();
  } catch (err) {
    console.error('❌ checkOfficeIP Error:', err);
    res.status(500).json({ message: 'Internal server error during IP check' });
  }
};
