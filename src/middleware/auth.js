const jwt = require('jsonwebtoken');

// Verifies "Authorization: Bearer <access token>"
exports.authenticate = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing access token' });
  try {
    const p = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: p.sub, role: p.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
};

// RBAC: checkRole(['SuperAdmin'])
exports.checkRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role))
    return res.status(403).json({ error: 'Forbidden: insufficient role' });
  next();
};
