const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('Environment variable JWT_SECRET is required.');
  process.exit(1);
}

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const [users] = await db.query('SELECT id, nama, email, role, nomor_hp, profile_photo FROM users WHERE id = ?', [decoded.id]);

    if (users.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = users[0];
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const requireRole = (roles) => {
  const normalizedRoles = roles.map(role => String(role).toLowerCase().trim());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = String(req.user.role || '').toLowerCase().trim();
    if (!normalizedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authenticate: authenticateToken, // Alias untuk kompatibilitas
  requireRole,
  JWT_SECRET,
};