const svc = require('./auth.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success } = require('../../utils/response');

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'];
  const userAgent = req.headers['user-agent'];

  const result = await svc.login(username, password, { ipAddress, userAgent });
  
  res.cookie('token', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  return res.json(success(result, 'Login successful'));
});

const googleLogin = asyncHandler(async (req, res) => {
  let { email, googleId, name, photoUrl, credential, code, redirectUri } = req.body;

  // If OAuth2 authorization code was passed, exchange for tokens using client secret
  if (code && !credential && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri || 'postmessage',
          grant_type: 'authorization_code'
        })
      });
      const tokenData = await tokenRes.json();
      if (tokenData.id_token) {
        credential = tokenData.id_token;
      }
    } catch (e) {
      console.warn('[googleLogin] Token exchange failed:', e.message);
    }
  }

  // If JWT credential from Google Identity Services is provided, decode payload
  if (credential && !email) {
    try {
      const parts = credential.split('.');
      if (parts.length === 3) {
        const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
        const payload = JSON.parse(payloadStr);
        email = payload.email;
        googleId = payload.sub;
        name = payload.name;
        photoUrl = payload.picture;
      }
    } catch (e) {
      console.warn('[googleLogin] Failed to parse credential token:', e.message);
    }
  }

  const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'];
  const userAgent = req.headers['user-agent'];

  const result = await svc.googleLogin({ email, googleId, name, photoUrl }, { ipAddress, userAgent });

  res.cookie('token', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  return res.json(success(result, 'Google authentication successful'));
});

const firstTimeChangePassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  const userId = req.user.id;

  const result = await svc.firstTimeChangePassword(userId, newPassword);

  res.cookie('token', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  return res.json(success(result, 'Password updated successfully. Account security initialized.'));
});

const refresh = asyncHandler(async (req, res) => {
  const result = await svc.refreshToken(req.user.id);

  res.cookie('token', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
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
  googleLogin,
  firstTimeChangePassword,
  refresh,
  logout,
  getMe,
};
