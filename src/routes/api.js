const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { authenticate, checkRole } = require('../middleware/auth');

router.use(authenticate);

// All authenticated roles
router.get('/employee/profile', checkRole(['SuperAdmin', 'Manager', 'Employee']), async (req, res) => {
  const u = await User.findById(req.user.id);
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role });
});

// Manager + SuperAdmin
router.post('/payroll/approve', checkRole(['Manager', 'SuperAdmin']), (req, res) => {
  res.json({ message: `Payroll approved by ${req.user.role}`, approvedAt: new Date().toISOString() });
});

// SuperAdmin only
router.delete('/users/:id', checkRole(['SuperAdmin']), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const deleted = await User.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'User not found' });
  await RefreshToken.deleteMany({ user: deleted.id });
  res.json({ message: 'User deleted' });
});

module.exports = router;
