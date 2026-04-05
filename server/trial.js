const fs = require('fs');
const path = require('path');

const TRIAL_FILE = path.join(__dirname, '../data/trial.json');
const TRIAL_DURATION = 48 * 60 * 60 * 1000; // 48h en millisecondes

function initTrial() {
  if (!fs.existsSync(TRIAL_FILE)) {
    const trial = {
      start: Date.now(),
      expires: Date.now() + TRIAL_DURATION
    };
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
  // Ne bloque pas les routes statiques ni /api/trial
  if (req.path === '/api/trial' || req.path === '/trial-expired.html') return next();
  if (!req.path.startsWith('/api/')) return next();
  // Bloque les API si expiré
  const { expired, hours, minutes } = getTrialInfo();
  if (expired) {
    return res.status(403).json({
      error: 'Version de démonstration expirée. Contactez l\'administrateur.',
      trial_expired: true
    });
  }
  next();
}

module.exports = { initTrial, getTrialInfo, trialMiddleware };
