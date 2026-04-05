const jwt = require('jsonwebtoken');
const SECRET = 'madrasati_secret_2024_maroc';

function authMiddleware(req, res, next) {
  const token = req.cookies?.token || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    // super a accès à tout
    if (req.user?.role === 'super') return next();
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole, SECRET };
