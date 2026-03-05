const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'egonetics-dev-secret-CHANGE-IN-PRODUCTION';

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET 未设置，使用开发默认值。生产环境请设置 JWT_SECRET 环境变量！');
}

function signToken(payload, expiresIn = '24h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权：缺少 Token' });
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? '未授权：Token 已过期，请重新登录'
      : '未授权：Token 无效';
    return res.status(401).json({ error: msg, expired: err.name === 'TokenExpiredError' });
  }
}

module.exports = { verifyToken, signToken, JWT_SECRET };
