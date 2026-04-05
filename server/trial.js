const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const SECRET = 'madrasati_secret_2024_maroc';

const TRIAL_FILE = path.join(__dirname, '../data/trial.json');
const TRIAL_DURATION = 48 * 60 * 60 * 1000; // 48h
const TRIAL_EMAIL = 'demo@madrasati.ma';

function initTrial() {
  if (!fs.existsSync(TRIAL_FILE)) {
    const trial = { start: Date.now(), expires: Date.now() + TRIAL_DURATION };
    fs.mkdirSync(path.dirname(TRIAL_FILE), { recursive: true });
    fs.writeFileSync(TRIAL_FILE, JSON.stringify(trial));
  }
}

function getTrialInfo() {
  initTrial();
  const trial = JSON.parse(fs.readFileSync(TRIAL_FILE));
  const now = Date.now();
  const expired = now > trial.expires;
  const remaining = Math.max(0, trial.expires - now);
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  return { expired, remaining, hours, minutes, expires: trial.expires };
}

function trialMiddleware(req, res, next) {
  if (req.path === '/api/trial' || req.path === '/trial-expired.html') return next();
  if (!req.path.startsWith('/api/')) return next();

  const token = req.cookies?.token || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return next();

  try {
    const user = jwt.verify(token, SECRET);
    if (user.email === TRIAL_EMAIL) {
      const { expired } = getTrialInfo();
      if (expired) {
        return res.status(403).json({
          error: "Votre version d'essai de 48h est expirée.",
          trial_expired: true
        });
      }
    }
  } catch(e) {}

  next();
}

module.exports = { initTrial, getTrialInfo, trialMiddleware, TRIAL_EMAIL };
