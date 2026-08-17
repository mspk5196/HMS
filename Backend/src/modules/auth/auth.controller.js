const svc = require('./auth.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success } = require('../../utils/response');

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const result = await svc.login(username, password);
  
  // Optionally set httpOnly cookie here, but returning token in body is fine for now
  res.cookie('token', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  });

  return res.json(success(result, 'Login successful'));
});

const refresh = asyncHandler(async (req, res) => {
  const result = await svc.refreshToken(req.user.id);

  res.cookie('token', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  });

  return res.json(success(result, 'Token refreshed'));
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token');
  return res.json(success(null, 'Logged out successfully'));
});

const getMe = asyncHandler(async (req, res) => {
  // If verifyToken middleware passed, req.user is set
  return res.json(success(req.user, 'Current user retrieved'));
});

module.exports = {
  login,
  refresh,
  logout,
  getMe,
};
