const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB, query, run, resetDB } = require('./database');
const { authMiddleware, requireRole, SECRET } = require('./auth');
const { getTrialInfo, trialMiddleware } = require('./trial');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ credentials: true, origin: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(trialMiddleware);


// ─── ABONNEMENT ───────────────────────────────────────────────────────────────

function getSubscriptionInfo(user) {
  if (user.role === 'super' || user.role === 'demo') return { active: true, unlimited: true };
  if (user.email === 'demo@madrasati.ma') return { active: true, unlimited: true };
  if (!user.subscriptionEnd) return { active: false, expired: true, daysLeft: 0 };
  const now = Date.now();
  const end = new Date(user.subscriptionEnd).getTime();
  const daysLeft = Math.ceil((end - now) / 86400000);
  return {
    active: daysLeft > 0,
    expired: daysLeft <= 0,
    daysLeft: Math.max(0, daysLeft),
    subscriptionEnd: user.subscriptionEnd,
    warning: daysLeft > 0 && daysLeft <= 7,
    attention: daysLeft > 7 && daysLeft <= 15
  };
}

// ─── TRIAL ───────────────────────────────────────────────────────────────────
app.get('/api/trial', (req, res) => {
  res.json(getTrialInfo(req));
});

// ─── AUTH ────────────────────────────────────────────────────────────────────

app.post('/api/login', async (req, res) => {
  await getDB();
  const { email, password } = req.body;
  const users = await query('SELECT * FROM users WHERE email = ? AND actif = 1', [email]);
  if (!users.length) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  const user = users[0];
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  const token = jwt.sign({ id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role }, SECRET, { expiresIn: '24h' });
  res.cookie('token', token, { httpOnly: true, maxAge: 86400000 });
  res.json({ token, user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role } });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const users = await query('SELECT id, nom, prenom, email, role, telephone FROM users WHERE id = ?', [req.user.id]);
  res.json(users[0]);
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

app.get('/api/dashboard', authMiddleware, async (req, res) => {
  await getDB();
  const stats = {};

  const totalEleves = await query('SELECT COUNT(*) as n FROM eleves WHERE statut="actif"');
  const totalProfs = await query('SELECT COUNT(*) as n FROM profs');
  const totalClasses = await query('SELECT COUNT(*) as n FROM classes');
  const facturesImpayees = await query('SELECT COUNT(*) as n, COALESCE(SUM(montant-montant_paye),0) as total FROM factures WHERE statut IN ("impayee","partielle")');
  const absencesToday = await query("SELECT COUNT(*) as n FROM presences WHERE date = date('now') AND statut='absent'");
  const annonces = await query('SELECT * FROM annonces WHERE actif=1 ORDER BY date_publication DESC LIMIT 5');
  const recentsFactures = await query(`
    SELECT f.*, u.nom, u.prenom FROM factures f
    JOIN eleves e ON f.eleve_id = e.id
    JOIN users u ON e.user_id = u.id
    ORDER BY f.date_emission DESC LIMIT 5
  `);
  const topEleves = await query(`
    SELECT u.nom, u.prenom, c.nom as classe,
    ROUND(AVG(n.valeur/n.sur*20),2) as moyenne
    FROM notes n
    JOIN eleves e ON n.eleve_id = e.id
    JOIN users u ON e.user_id = u.id
    JOIN classes c ON e.classe_id = c.id
    GROUP BY n.eleve_id ORDER BY moyenne DESC LIMIT 5
  `);

  stats.totalEleves = totalEleves[0].n;
  stats.totalProfs = totalProfs[0].n;
  stats.totalClasses = totalClasses[0].n;
  stats.facturesImpayees = facturesImpayees[0].n;
  stats.montantImpaye = facturesImpayees[0].total;
  stats.absencesToday = absencesToday[0].n;
  stats.annonces = annonces;
  stats.recentsFactures = recentsFactures;
  stats.topEleves = topEleves;

  res.json(stats);
});

// ─── ÉLÈVES ──────────────────────────────────────────────────────────────────

app.get('/api/eleves', authMiddleware, async (req, res) => {
  const { search, classe_id } = req.query;
  let sql = `
    SELECT e.*, u.nom, u.prenom, u.email, u.telephone, c.nom as classe_nom,
    p.nom as parent_nom, p.prenom as parent_prenom, p.telephone as parent_tel
    FROM eleves e
    JOIN users u ON e.user_id = u.id
    LEFT JOIN classes c ON e.classe_id = c.id
    LEFT JOIN users p ON e.parent_id = p.id
    WHERE e.statut = 'actif'
  `;
  const params = [];
  if (search) { sql += ` AND (u.nom LIKE ? OR u.prenom LIKE ? OR e.numero_matricule LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (classe_id) { sql += ` AND e.classe_id = ?`; params.push(classe_id); }
  sql += ` ORDER BY u.nom, u.prenom`;
  const rows = await query(sql, params);
  res.json(rows);
});

app.get('/api/eleves/:id', authMiddleware, async (req, res) => {
  const eleves = await query(`
    SELECT e.*, u.nom, u.prenom, u.email, u.telephone, u.adresse, u.date_naissance, c.nom as classe_nom,
    p.nom as parent_nom, p.prenom as parent_prenom, p.telephone as parent_tel, p.email as parent_email
    FROM eleves e
    JOIN users u ON e.user_id = u.id
    LEFT JOIN classes c ON e.classe_id = c.id
    LEFT JOIN users p ON e.parent_id = p.id
    WHERE e.id = ?
  `, [req.params.id]);
  if (!eleves.length) return res.status(404).json({ error: 'Élève non trouvé' });
  res.json(eleves[0]);
});

app.post('/api/eleves', authMiddleware, requireRole('admin'), async (req, res) => {
  const { nom, prenom, email, telephone, adresse, date_naissance, classe_id, parent_id } = req.body;
  const pwd = bcrypt.hashSync('eleve123', 10);
  const userResult = await run(
    'INSERT INTO users (nom, prenom, email, password, role, telephone, adresse, date_naissance) VALUES (?,?,?,?,?,?,?,?)',
    [nom, prenom, email, pwd, 'eleve', telephone, adresse, date_naissance]
  );
  const user_id = userResult.lastInsertRowid;
  const year = new Date().getFullYear();
  const count = await query('SELECT COUNT(*) as n FROM eleves');
  const matricule = `MAT-${year}-${String(count[0].n + 1).padStart(3, '0')}`;
  await run(
    'INSERT INTO eleves (user_id, classe_id, numero_matricule, parent_id, date_inscription) VALUES (?,?,?,?,date("now"))',
    [user_id, classe_id, matricule, parent_id]
  );
  res.json({ ok: true, matricule });
});

app.put('/api/eleves/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { nom, prenom, email, telephone, adresse, date_naissance, classe_id } = req.body;
  const eleve = await query('SELECT user_id FROM eleves WHERE id = ?', [req.params.id]);
  if (!eleve.length) return res.status(404).json({ error: 'Élève non trouvé' });
  await run('UPDATE users SET nom=?, prenom=?, email=?, telephone=?, adresse=?, date_naissance=? WHERE id=?',
    [nom, prenom, email, telephone, adresse, date_naissance, eleve[0].user_id]);
  await run('UPDATE eleves SET classe_id=? WHERE id=?', [classe_id, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/eleves/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  await run('UPDATE eleves SET statut="inactif" WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ─── PROFS ───────────────────────────────────────────────────────────────────

app.get('/api/profs', authMiddleware, async (req, res) => {
  const rows = await query(`
    SELECT p.*, u.nom, u.prenom, u.email, u.telephone, u.adresse,
    COUNT(DISTINCT pm.classe_id) as nb_classes,
    GROUP_CONCAT(DISTINCT m.nom) as matieres
    FROM profs p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN prof_matieres pm ON pm.prof_id = p.id
    LEFT JOIN matieres m ON pm.matiere_id = m.id
    WHERE u.actif = 1
    GROUP BY p.id ORDER BY u.nom
  `);
  res.json(rows);
});

app.post('/api/profs', authMiddleware, requireRole('admin'), async (req, res) => {
  const { nom, prenom, email, telephone, specialite, cin, date_embauche, salaire } = req.body;
  const pwd = bcrypt.hashSync('prof123', 10);
  const r = await run('INSERT INTO users (nom, prenom, email, password, role, telephone) VALUES (?,?,?,?,?,?)',
    [nom, prenom, email, pwd, 'prof', telephone]);
  await run('INSERT INTO profs (user_id, specialite, cin, date_embauche, salaire) VALUES (?,?,?,?,?)',
    [r.lastInsertRowid, specialite, cin, date_embauche, salaire]);
  res.json({ ok: true });
});

app.put('/api/profs/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { nom, prenom, email, telephone, specialite, cin } = req.body;
  const prof = await query('SELECT user_id FROM profs WHERE id=?', [req.params.id]);
  if (!prof.length) return res.status(404).json({ error: 'Prof non trouvé' });
  await run('UPDATE users SET nom=?, prenom=?, email=?, telephone=? WHERE id=?',
    [nom, prenom, email, telephone, prof[0].user_id]);
  await run('UPDATE profs SET specialite=?, cin=? WHERE id=?', [specialite, cin, req.params.id]);
  res.json({ ok: true });
});

// ─── CLASSES ─────────────────────────────────────────────────────────────────

app.get('/api/classes', authMiddleware, async (req, res) => {
  const rows = await query(`
    SELECT c.*, n.nom as niveau_nom,
    u.nom as prof_nom, u.prenom as prof_prenom,
    COUNT(DISTINCT e.id) as nb_eleves
    FROM classes c
    LEFT JOIN niveaux n ON c.niveau_id = n.id
    LEFT JOIN users u ON c.prof_principal_id = u.id
    LEFT JOIN eleves e ON e.classe_id = c.id AND e.statut = 'actif'
    GROUP BY c.id ORDER BY n.ordre, c.nom
  `);
  res.json(rows);
});

app.post('/api/classes', authMiddleware, requireRole('admin'), async (req, res) => {
  const { nom, niveau_id, prof_principal_id, annee_scolaire, max_eleves } = req.body;
  await run('INSERT INTO classes (nom, niveau_id, prof_principal_id, annee_scolaire, max_eleves) VALUES (?,?,?,?,?)',
    [nom, niveau_id, prof_principal_id, annee_scolaire, max_eleves]);
  res.json({ ok: true });
});

app.get('/api/niveaux', authMiddleware, async (req, res) => {
  const rows = await query('SELECT * FROM niveaux ORDER BY ordre');
  res.json(rows);
});

// ─── EMPLOI DU TEMPS ─────────────────────────────────────────────────────────

app.get('/api/emploi-du-temps', authMiddleware, async (req, res) => {
  const { classe_id, prof_id } = req.query;
  let sql = `
    SELECT edt.*, c.nom as classe_nom, m.nom as matiere_nom, m.couleur,
    u.nom as prof_nom, u.prenom as prof_prenom
    FROM emploi_du_temps edt
    JOIN classes c ON edt.classe_id = c.id
    JOIN matieres m ON edt.matiere_id = m.id
    JOIN profs p ON edt.prof_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (classe_id) { sql += ' AND edt.classe_id = ?'; params.push(classe_id); }
  if (prof_id) { sql += ' AND edt.prof_id = ?'; params.push(prof_id); }
  sql += " ORDER BY CASE edt.jour WHEN 'Lundi' THEN 1 WHEN 'Mardi' THEN 2 WHEN 'Mercredi' THEN 3 WHEN 'Jeudi' THEN 4 WHEN 'Vendredi' THEN 5 WHEN 'Samedi' THEN 6 END, edt.heure_debut";
  const rows = await query(sql, params);
  res.json(rows);
});

app.post('/api/emploi-du-temps', authMiddleware, requireRole('admin'), async (req, res) => {
  const { classe_id, matiere_id, prof_id, jour, heure_debut, heure_fin, salle } = req.body;
  await run('INSERT INTO emploi_du_temps (classe_id, matiere_id, prof_id, jour, heure_debut, heure_fin, salle) VALUES (?,?,?,?,?,?,?)',
    [classe_id, matiere_id, prof_id, jour, heure_debut, heure_fin, salle]);
  res.json({ ok: true });
});

app.delete('/api/emploi-du-temps/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  await run('DELETE FROM emploi_du_temps WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ─── PRÉSENCES ───────────────────────────────────────────────────────────────

app.get('/api/presences', authMiddleware, async (req, res) => {
  const { classe_id, date, eleve_id } = req.query;
  let sql = `
    SELECT pr.*, u.nom, u.prenom, e.numero_matricule, c.nom as classe_nom, m.nom as matiere_nom
    FROM presences pr
    JOIN eleves e ON pr.eleve_id = e.id
    JOIN users u ON e.user_id = u.id
    LEFT JOIN classes c ON e.classe_id = c.id
    LEFT JOIN matieres m ON pr.matiere_id = m.id
    WHERE 1=1
  `;
  const params = [];
  if (classe_id) { sql += ' AND e.classe_id = ?'; params.push(classe_id); }
  if (date) { sql += ' AND pr.date = ?'; params.push(date); }
  if (eleve_id) { sql += ' AND pr.eleve_id = ?'; params.push(eleve_id); }
  sql += ' ORDER BY pr.date DESC, u.nom';
  const rows = await query(sql, params);
  res.json(rows);
});

app.post('/api/presences', authMiddleware, async (req, res) => {
  const { presences } = req.body;
  for (const p of presences) {
    const existing = await query('SELECT id FROM presences WHERE eleve_id=? AND date=? AND matiere_id=?', [p.eleve_id, p.date, p.matiere_id]);
    if (existing.length) {
      await run('UPDATE presences SET statut=?, remarque=? WHERE id=?', [p.statut, p.remarque, existing[0].id]);
    } else {
      await run('INSERT INTO presences (eleve_id, date, statut, matiere_id, remarque, saisi_par) VALUES (?,?,?,?,?,?)',
        [p.eleve_id, p.date, p.statut, p.matiere_id, p.remarque, req.user.id]);
    }
  }
  res.json({ ok: true });
});

app.get('/api/presences/stats/:eleve_id', authMiddleware, async (req, res) => {
  const stats = await query(`
    SELECT statut, COUNT(*) as total FROM presences WHERE eleve_id=? GROUP BY statut
  `, [req.params.eleve_id]);
  res.json(stats);
});

// ─── NOTES ───────────────────────────────────────────────────────────────────

app.get('/api/matieres', authMiddleware, async (req, res) => {
  const rows = await query('SELECT * FROM matieres ORDER BY nom');
  res.json(rows);
});

app.get('/api/periodes', authMiddleware, async (req, res) => {
  const rows = await query('SELECT * FROM periodes ORDER BY id');
  res.json(rows);
});

app.get('/api/notes', authMiddleware, async (req, res) => {
  const { eleve_id, classe_id, matiere_id, periode_id } = req.query;
  let sql = `
    SELECT n.*, u.nom, u.prenom, m.nom as matiere_nom, m.coefficient, p.nom as periode_nom
    FROM notes n
    JOIN eleves e ON n.eleve_id = e.id
    JOIN users u ON e.user_id = u.id
    JOIN matieres m ON n.matiere_id = m.id
    LEFT JOIN periodes p ON n.periode_id = p.id
    WHERE 1=1
  `;
  const params = [];
  if (eleve_id) { sql += ' AND n.eleve_id=?'; params.push(eleve_id); }
  if (classe_id) { sql += ' AND e.classe_id=?'; params.push(classe_id); }
  if (matiere_id) { sql += ' AND n.matiere_id=?'; params.push(matiere_id); }
  if (periode_id) { sql += ' AND n.periode_id=?'; params.push(periode_id); }
  sql += ' ORDER BY u.nom, m.nom, n.date_saisie';
  const rows = await query(sql, params);
  res.json(rows);
});

app.post('/api/notes', authMiddleware, requireRole('admin', 'prof'), async (req, res) => {
  const { eleve_id, matiere_id, periode_id, type_note, valeur, sur, remarque } = req.body;
  await run('INSERT INTO notes (eleve_id, matiere_id, periode_id, type_note, valeur, sur, remarque, saisi_par) VALUES (?,?,?,?,?,?,?,?)',
    [eleve_id, matiere_id, periode_id, type_note, valeur, sur, remarque, req.user.id]);
  res.json({ ok: true });
});

app.put('/api/notes/:id', authMiddleware, requireRole('admin', 'prof'), async (req, res) => {
  const { valeur, remarque } = req.body;
  await run('UPDATE notes SET valeur=?, remarque=? WHERE id=?', [valeur, remarque, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/notes/:id', authMiddleware, requireRole('admin', 'prof'), async (req, res) => {
  await run('DELETE FROM notes WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/bulletin/:eleve_id/:periode_id', authMiddleware, async (req, res) => {
  const { eleve_id, periode_id } = req.params;
  const eleve = await query(`
    SELECT e.*, u.nom, u.prenom, c.nom as classe_nom
    FROM eleves e JOIN users u ON e.user_id=u.id LEFT JOIN classes c ON e.classe_id=c.id
    WHERE e.id=?
  `, [eleve_id]);
  const periode = await query('SELECT * FROM periodes WHERE id=?', [periode_id]);
  const notes = await query(`
    SELECT m.nom as matiere, m.coefficient, n.type_note, n.valeur, n.sur,
    ROUND(AVG(n.valeur/n.sur*20),2) as moyenne
    FROM notes n JOIN matieres m ON n.matiere_id=m.id
    WHERE n.eleve_id=? AND n.periode_id=?
    GROUP BY n.matiere_id
    ORDER BY m.nom
  `, [eleve_id, periode_id]);
  const totalCoef = notes.reduce((s, n) => s + (n.coefficient || 1), 0);
  const moyenneGen = totalCoef > 0
    ? notes.reduce((s, n) => s + (n.moyenne || 0) * (n.coefficient || 1), 0) / totalCoef
    : 0;
  const presences = await query(`
    SELECT statut, COUNT(*) as total FROM presences WHERE eleve_id=? GROUP BY statut
  `, [eleve_id]);
  res.json({ eleve: eleve[0], periode: periode[0], notes, moyenneGen: Math.round(moyenneGen * 100) / 100, presences });
});

// ─── FACTURATION ─────────────────────────────────────────────────────────────

app.get('/api/factures', authMiddleware, async (req, res) => {
  const { statut, eleve_id, search } = req.query;
  let sql = `
    SELECT f.*, u.nom, u.prenom, e.numero_matricule, c.nom as classe_nom
    FROM factures f
    JOIN eleves e ON f.eleve_id = e.id
    JOIN users u ON e.user_id = u.id
    LEFT JOIN classes c ON e.classe_id = c.id
    WHERE f.statut != 'annulee'
  `;
  const params = [];
  if (statut) { sql += ' AND f.statut=?'; params.push(statut); }
  if (eleve_id) { sql += ' AND f.eleve_id=?'; params.push(eleve_id); }
  if (search) { sql += ' AND (u.nom LIKE ? OR u.prenom LIKE ? OR f.numero LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY f.date_emission DESC';
  const rows = await query(sql, params);
  res.json(rows);
});

app.get('/api/factures/:id', authMiddleware, async (req, res) => {
  const factures = await query(`
    SELECT f.*, u.nom, u.prenom, u.telephone, u.adresse, e.numero_matricule, c.nom as classe_nom
    FROM factures f JOIN eleves e ON f.eleve_id=e.id JOIN users u ON e.user_id=u.id
    LEFT JOIN classes c ON e.classe_id=c.id WHERE f.id=?
  `, [req.params.id]);
  if (!factures.length) return res.status(404).json({ error: 'Facture non trouvée' });
  const paiements = await query('SELECT * FROM paiements WHERE facture_id=? ORDER BY date_paiement DESC', [req.params.id]);
  res.json({ ...factures[0], paiements });
});

app.post('/api/factures', authMiddleware, requireRole('admin'), async (req, res) => {
  const { eleve_id, description, montant, date_echeance, notes } = req.body;
  const count = await query('SELECT COUNT(*) as n FROM factures');
  const numero = `FAC-${new Date().getFullYear()}-${String(count[0].n + 1).padStart(4, '0')}`;
  await run('INSERT INTO factures (eleve_id, numero, description, montant, date_echeance, notes) VALUES (?,?,?,?,?,?)',
    [eleve_id, numero, description, montant, date_echeance, notes]);
  res.json({ ok: true, numero });
});

app.post('/api/factures/:id/paiement', authMiddleware, requireRole('admin'), async (req, res) => {
  const { montant, mode, reference, notes } = req.body;
  const facture = await query('SELECT * FROM factures WHERE id=?', [req.params.id]);
  if (!facture.length) return res.status(404).json({ error: 'Facture non trouvée' });
  const f = facture[0];
  const newPaye = (f.montant_paye || 0) + parseFloat(montant);
  const newStatut = newPaye >= f.montant ? 'payee' : 'partielle';
  await run('UPDATE factures SET montant_paye=?, statut=?, date_paiement=date("now"), mode_paiement=? WHERE id=?',
    [newPaye, newStatut, mode, req.params.id]);
  await run('INSERT INTO paiements (facture_id, montant, mode, reference, notes, saisi_par) VALUES (?,?,?,?,?,?)',
    [req.params.id, montant, mode, reference, notes, req.user.id]);
  res.json({ ok: true, statut: newStatut });
});

app.get('/api/factures/stats/summary', authMiddleware, async (req, res) => {
  const summary = await query(`
    SELECT
      SUM(montant) as total_emis,
      SUM(montant_paye) as total_paye,
      SUM(montant - montant_paye) as total_impaye,
      COUNT(*) as nb_total,
      SUM(CASE WHEN statut='payee' THEN 1 ELSE 0 END) as nb_payees,
      SUM(CASE WHEN statut='impayee' THEN 1 ELSE 0 END) as nb_impayees,
      SUM(CASE WHEN statut='partielle' THEN 1 ELSE 0 END) as nb_partielles
    FROM factures WHERE statut != 'annulee'
  `);
  res.json(summary[0]);
});

// ─── ANNONCES ────────────────────────────────────────────────────────────────

app.get('/api/annonces', authMiddleware, async (req, res) => {
  const rows = await query(`
    SELECT a.*, u.nom, u.prenom FROM annonces a
    JOIN users u ON a.auteur_id = u.id
    WHERE a.actif = 1
    ORDER BY a.date_publication DESC
  `);
  res.json(rows);
});

app.post('/api/annonces', authMiddleware, requireRole('admin', 'prof'), async (req, res) => {
  const { titre, contenu, destinataires } = req.body;
  await run('INSERT INTO annonces (titre, contenu, auteur_id, destinataires) VALUES (?,?,?,?)',
    [titre, contenu, req.user.id, destinataires]);
  res.json({ ok: true });
});

app.delete('/api/annonces/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  await run('UPDATE annonces SET actif=0 WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ─── USERS ───────────────────────────────────────────────────────────────────

app.get('/api/users', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const rows = await query('SELECT id, nom, prenom, email, role, telephone, actif, subscriptionEnd, created_at FROM users ORDER BY nom');
  res.json(rows.map(u => ({ ...u, subscription: getSubscriptionInfo(u) })));
});

// Créer un utilisateur (super admin uniquement)
app.post('/api/users', authMiddleware, requireRole('super'), async (req, res) => {
  const { nom, prenom, email, password, role, telephone } = req.body;
  if (!nom || !prenom || !email || !password) return res.status(400).json({ error: 'Champs manquants' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (min 6 caractères)' });
  const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) return res.status(400).json({ error: 'Email déjà utilisé' });
  const hashed = bcrypt.hashSync(password, 10);
  await run('INSERT INTO users (nom, prenom, email, password, role, telephone) VALUES (?,?,?,?,?,?)',
    [nom, prenom, email, hashed, role || 'admin', telephone || '']);
  res.json({ ok: true });
});

// Désactiver un utilisateur (super admin)
app.delete('/api/users/:id', authMiddleware, requireRole('super'), async (req, res) => {
  const id = parseInt(req.params.id);
  const superUser = await query('SELECT id FROM users WHERE role = ? ORDER BY id LIMIT 1', ['super']);
  if (superUser.length && superUser[0].id === id) return res.status(400).json({ error: 'Impossible de supprimer le super admin' });
  await run('UPDATE users SET actif = 0 WHERE id = ?', [id]);
  res.json({ ok: true });
});

// Réinitialiser mot de passe (super admin)
app.put('/api/users/:id/reset-password', authMiddleware, requireRole('super'), async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mot de passe trop court' });
  const hashed = bcrypt.hashSync(newPassword, 10);
  await run('UPDATE users SET password = ? WHERE id = ?', [hashed, req.params.id]);
  res.json({ ok: true });
});

// Changer son propre mot de passe
app.put('/api/users/:id/password', authMiddleware, async (req, res) => {
  if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin' && req.user.role !== 'super') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const { currentPassword, password } = req.body;
  // Si currentPassword fourni, on vérifie l'ancien
  if (currentPassword) {
    const users = await query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!users.length || !bcrypt.compareSync(currentPassword, users[0].password)) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }
  }
  const hashed = bcrypt.hashSync(password, 10);
  await run('UPDATE users SET password=? WHERE id=?', [hashed, req.params.id]);
  res.json({ ok: true });
});



// ─── EXPORT / IMPORT / RESET ──────────────────────────────────────────────────

app.get('/api/export', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  await getDB();
  const data = {
    exportDate: new Date().toISOString(),
    eleves: await query('SELECT * FROM eleves'),
    users: await query('SELECT id,nom,prenom,email,role,telephone,adresse,date_naissance,actif FROM users WHERE role NOT IN ("super","demo")'),
    classes: await query('SELECT * FROM classes'),
    niveaux: await query('SELECT * FROM niveaux'),
    matieres: await query('SELECT * FROM matieres'),
    profs: await query('SELECT * FROM profs'),
    prof_matieres: await query('SELECT * FROM prof_matieres'),
    emploi_du_temps: await query('SELECT * FROM emploi_du_temps'),
    periodes: await query('SELECT * FROM periodes'),
    notes: await query('SELECT * FROM notes'),
    presences: await query('SELECT * FROM presences'),
    factures: await query('SELECT * FROM factures'),
    paiements: await query('SELECT * FROM paiements'),
    annonces: await query('SELECT * FROM annonces'),
    conges: await query('SELECT * FROM conges'),
  };
  res.setHeader('Content-Disposition', 'attachment; filename=madrasati_backup_' + new Date().toISOString().slice(0,10) + '.json');
  res.json(data);
});

app.post('/api/import', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.eleves) return res.status(400).json({ error: 'Format JSON invalide' });
    // On importe uniquement les données scolaires (pas les users système)
    const tables = ['notes','presences','paiements','factures','annonces','conges','emploi_du_temps','prof_matieres'];
    for (const t of tables) await run(`DELETE FROM ${t}`);
    await run('DELETE FROM eleves');
    await run('DELETE FROM profs');
    await run('DELETE FROM classes');
    await run('DELETE FROM matieres');
    await run('DELETE FROM niveaux');
    await run('DELETE FROM periodes');
    // Réimporter
    const insertAll = async (table, rows) => {
      if (!rows || !rows.length) return;
      for (const row of rows) {
        const cols = Object.keys(row).join(',');
        const vals = Object.keys(row).map(() => '?').join(',');
        await run(`INSERT OR IGNORE INTO ${table} (${cols}) VALUES (${vals})`, Object.values(row));
      }
    };
    await insertAll('niveaux', data.niveaux);
    await insertAll('classes', data.classes);
    await insertAll('matieres', data.matieres);
    await insertAll('periodes', data.periodes);
    if (data.users) {
      for (const u of data.users) {
        if (!['super','demo','admin'].includes(u.role)) {
          await run('INSERT OR IGNORE INTO users (id,nom,prenom,email,password,role,telephone) VALUES (?,?,?,?,?,?,?)',
            [u.id, u.nom, u.prenom, u.email, u.password || '$2a$10$x', u.role, u.telephone || '']);
        }
      }
    }
    await insertAll('profs', data.profs);
    await insertAll('eleves', data.eleves);
    await insertAll('prof_matieres', data.prof_matieres);
    await insertAll('emploi_du_temps', data.emploi_du_temps);
    await insertAll('notes', data.notes);
    await insertAll('presences', data.presences);
    await insertAll('factures', data.factures);
    await insertAll('paiements', data.paiements);
    await insertAll('annonces', data.annonces);
    await insertAll('conges', data.conges);
    res.json({ ok: true, message: 'Import réussi' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/reset', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  try {
    // Ordre important : d'abord les tables avec FK, puis les tables principales
    const tables = [
      'paiements', 'notes', 'presences', 'conges',
      'emploi_du_temps', 'prof_matieres',
      'factures', 'annonces',
      'eleves', 'profs',
      'classes', 'matieres', 'niveaux', 'periodes'
    ];
    for (const t of tables) {
      try { await run(`DELETE FROM ${t}`); } catch(e) {}
    }
    // Supprimer users sauf comptes système
    await run("DELETE FROM users WHERE role NOT IN ('super','admin','demo')");
    // Forcer sauvegarde sur disque
    const { saveDB } = require('./database');
    saveDB();
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ABONNEMENT ROUTES ────────────────────────────────────────────────────────

app.get('/api/subscription', authMiddleware, async (req, res) => {
  if (req.user.role === 'super' || req.user.role === 'demo') return res.json({ unlimited: true });
  const users = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!users.length) return res.json({ expired: true });
  const user = users[0];
  res.json(getSubscriptionInfo(user));
});

app.put('/api/users/:id/renew', authMiddleware, requireRole('super'), async (req, res) => {
  const { months } = req.body;
  const days = (months || 1) * 30;
  const users = await query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!users.length) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  const user = users[0];
  const now = Date.now();
  const currentEnd = user.subscriptionEnd ? new Date(user.subscriptionEnd).getTime() : now;
  const newEnd = new Date(Math.max(now, currentEnd) + days * 86400000).toISOString();
  await run('UPDATE users SET subscriptionEnd = ? WHERE id = ?', [newEnd, req.params.id]);
  res.json({ ok: true, subscriptionEnd: newEnd, daysAdded: days });
});

// ─── PAGE ADMIN ───────────────────────────────────────────────────────────────

app.get('/admin', (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.redirect('/');
  try {
    const user = jwt.verify(token, SECRET);
    if (user.role !== 'super') return res.redirect('/');
    res.sendFile(path.join(__dirname, '../public/admin.html'));
  } catch(e) { res.redirect('/'); }
});

// ─── RESET SECRET (usage unique) ─────────────────────────────────────────────
app.get('/api/reset-db-secret-2026', async (req, res) => {
  try {
    const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '../data');
    const dbPath = path.join(DATA_DIR, 'madrasati.db');
    const trialPath = path.join(DATA_DIR, 'trial.json');
    const trialIpsPath = path.join(DATA_DIR, 'trial_ips.json');
    if (require('fs').existsSync(dbPath)) require('fs').unlinkSync(dbPath);
    if (require('fs').existsSync(trialPath)) require('fs').unlinkSync(trialPath);
    if (require('fs').existsSync(trialIpsPath)) require('fs').unlinkSync(trialIpsPath);
    // Réinitialiser le module db en mémoire
    const dbModule = require('./database');
    if (dbModule.resetDB) dbModule.resetDB();
    res.send('<h2 style="font-family:sans-serif;padding:20px;color:green">✅ Base supprimée ! <a href="/">Cliquez ici pour revenir</a></h2>');
  } catch(e) {
    res.status(500).send('<h2 style="color:red">Erreur: ' + e.message + '</h2>');
  }
});

// ─── STATIC PAGES ─────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ─── START ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

getDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n✅ Madrasati démarré sur http://localhost:${PORT}`);
    console.log(`\n🔐 Comptes de test:`);
    console.log(`   Admin  : admin@madrasati.ma / admin123`);
    console.log(`   Prof   : prof1@madrasati.ma / prof123`);
    console.log(`   Élève  : eleve1@madrasati.ma / eleve123`);
    console.log(`   Parent : parent1@madrasati.ma / eleve123\n`);
  });
}).catch(err => {
  console.error('Erreur démarrage DB:', err);
});
