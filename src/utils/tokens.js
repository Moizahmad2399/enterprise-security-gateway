const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const isDev = process.env.NODE_ENV === 'development';

const signAccess = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

async function issueRefresh(user) {
  const jti = crypto.randomUUID();
  await RefreshToken.create({ jti, user: user.id, expiresAt: new Date(Date.now() + REFRESH_MS) });
  return jwt.sign({ sub: user.id, jti }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

const cookieOpts = {
  httpOnly: true,
  secure: !isDev,          // HTTPS only (deployed)
  sameSite: 'strict',
  path: '/api/v1/auth',
  maxAge: REFRESH_MS,
};
const setRefreshCookie = (res, token) => res.cookie('refreshToken', token, cookieOpts);
const clearRefreshCookie = (res) => res.clearCookie('refreshToken', { ...cookieOpts, maxAge: undefined });

module.exports = { signAccess, issueRefresh, setRefreshCookie, clearRefreshCookie };
