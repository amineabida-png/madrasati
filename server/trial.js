const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const SECRET = 'madrasati_secret_2024_maroc';

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? process.env.RAILWAY_VOLUME_MOUNT_PATH
  : path.join(__dirname, '../data');
const TRIAL_FILE = path.join(DATA_DIR, 'trial_ips.json');
const TRIAL_DURATION = 24 * 60 * 60 * 1000; // 24h
const TRIAL_EMAIL = 'demo@madrasati.ma';

// Récupère l'IP réelle du visiteur (Railway utilise un proxy)
function getIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// Charge la base des IPs
function loadIPs() {
  try {
    if (fs.existsSync(TRIAL_FILE)) {
      return JSON.parse(fs.readFileSync(TRIAL_FILE, 'utf8'));
    }
  } catch(e) {}
  return {};
}

// Sauvegarde la base des IPs
function saveIPs(data) {
  fs.mkdirSync(path.dirname(TRIAL_FILE), { recursive: true });
  fs.writeFileSync(TRIAL_FILE, JSON.stringify(data, null, 2));
}

// Retourne les infos de trial pour une IP donnée
function getTrialInfoForIP(ip) {
  const ips = loadIPs();
  const now = Date.now();

  // Nouvelle IP : on l'enregistre et démarre son timer
  if (!ips[ip]) {
    ips[ip] = { start: now, expires: now + TRIAL_DURATION };
    saveIPs(ips);
  }

  const trial = ips[ip];
  const expired = now > trial.expires;
  const remaining = Math.max(0, trial.expires - now);
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);

  return { expired, remaining, hours, minutes, expires: trial.expires, ip };
}

// Pour l'API /api/trial (utilisé par le frontend)
function getTrialInfo(req) {
  const ip = req ? getIP(req) : 'unknown';
  return getTrialInfoForIP(ip);
}

function trialMiddleware(req, res, next) {
  if (req.path === '/api/trial' || req.path === '/trial-expired.html') return next();
  if (!req.path.startsWith('/api/')) return next();

  const token = req.cookies?.token || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return next();

  try {
    const user = jwt.verify(token, SECRET);
    if (user.email === TRIAL_EMAIL) {
      const ip = getIP(req);
      const { expired } = getTrialInfoForIP(ip);
      if (expired) {
        return res.status(403).json({
          error: "Votre version d'essai de 24h est expirée.",
          trial_expired: true
        });
      }
    }
  } catch(e) {}

  next();
}

module.exports = { getTrialInfo, trialMiddleware, TRIAL_EMAIL };
