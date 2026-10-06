const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passport = require('passport');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { loginLimiter } = require('../middleware/rateLimit');
const { signAccess, issueRefresh, setRefreshCookie, clearRefreshCookie } = require('../utils/tokens');

const DUMMY_HASH = bcrypt.hashSync('dummy-password', 12); // equalises timing for unknown emails
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;
const emailOk = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (typeof name !== 'string' || !name.trim() || !emailOk(email) || typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ error: 'name, valid email and password (min 8 chars) required' });
  if (await User.findOne({ email })) return res.status(409).json({ error: 'Email already registered' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role: 'Employee' }); // role is never client-controlled
  res.status(201).json({ id: user.id, email: user.email, role: user.role });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!emailOk(email) || typeof password !== 'string') return res.status(400).json({ error: 'Invalid credentials format' });
  const user = await User.findOne({ email }).select('+passwordHash');

  if (user?.lockUntil && user.lockUntil > Date.now())
    return res.status(423).json({ error: 'Account locked. Try again later.' });

  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) {
    if (user) {
      user.failedAttempts += 1;
      if (user.failedAttempts >= MAX_FAILS) { user.lockUntil = new Date(Date.now() + LOCK_MS); user.failedAttempts = 0; }
      await user.save();
    }
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  user.failedAttempts = 0; user.lockUntil = undefined; await user.save();

  setRefreshCookie(res, await issueRefresh(user));
  res.json({ accessToken: signAccess(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// Refresh Token Rotation + reuse detection
router.post('/refresh', async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh token' });
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET); }
  catch { clearRefreshCookie(res); return res.status(401).json({ error: 'Invalid refresh token' }); }

  const stored = await RefreshToken.findOne({ jti: payload.jti });
  if (!stored || stored.revoked) {
    // Reused/unknown token => assume theft, kill every session of this user
    await RefreshToken.updateMany({ user: payload.sub }, { revoked: true });
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Refresh token reuse detected. All sessions revoked.' });
  }
  stored.revoked = true; await stored.save();          // old token is single-use

  const user = await User.findById(payload.sub);
  if (!user) { clearRefreshCookie(res); return res.status(401).json({ error: 'User no longer exists' }); }
  setRefreshCookie(res, await issueRefresh(user));     // new rotated token
  res.json({ accessToken: signAccess(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.post('/logout', async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    try { const p = jwt.verify(token, process.env.JWT_REFRESH_SECRET); await RefreshToken.updateOne({ jti: p.jti }, { revoked: true }); } catch {}
  }
  clearRefreshCookie(res);
  res.json({ message: 'Logged out, refresh token revoked' });
});

// ---- GitHub OAuth 2.0 ----
router.get('/github', (req, res, next) => {
  const state = crypto.randomBytes(16).toString('hex'); // CSRF protection for the OAuth flow
  res.cookie('oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'lax', maxAge: 10 * 60 * 1000 });
  passport.authenticate('github', { scope: ['user:email'], session: false, state })(req, res, next);
});

router.get('/github/callback',
  (req, res, next) => {
    if (!req.query.state || req.query.state !== req.cookies.oauth_state) return res.status(400).json({ error: 'Invalid OAuth state' });
    res.clearCookie('oauth_state');
    next();
  },
  passport.authenticate('github', { session: false, failureRedirect: '/?oauth=failed' }),
  async (req, res) => {
    setRefreshCookie(res, await issueRefresh(req.user));   // system credentials; frontend then calls /refresh for an access token
    res.redirect('/?oauth=success');
  });

module.exports = router;
