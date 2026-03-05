function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '未授权' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `权限不足，需要角色: ${roles.join(' 或 ')}` });
    }
    next();
  };
}

const requireAdmin = requireRole('admin');
const requireAdminOrAgent = requireRole('admin', 'agent');

module.exports = { requireRole, requireAdmin, requireAdminOrAgent };
