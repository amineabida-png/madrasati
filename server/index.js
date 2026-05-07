const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB, query, run, saveDB, resetDB } = require('./database');
const { authMiddleware, requireRole, SECRET } = require('./auth');
const { getTrialInfo, trialMiddleware } = require('./trial');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(cors({ credentials: true, origin: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(trialMiddleware);

// ─── ABONNEMENT ───────────────────────────────────────────────────────────────
function getSubscriptionInfo(user) {
  if (user.role === 'super') return { active: true, unlimited: true };
  if (user.email === 'demo@madrasati.ma') return { active: true, unlimited: true };
  if (user.lifetime) return { active: true, unlimited: true, lifetime: true };
  if (!user.subscriptionEnd) return { active: true, unlimited: false, daysLeft: 0, noSubscription: true };
  const now = Date.now();
  const end = new Date(user.subscriptionEnd).getTime();
  const daysLeft = Math.ceil((end - now) / 86400000);
  return { active: daysLeft > 0, expired: daysLeft <= 0, daysLeft: Math.max(0, daysLeft), subscriptionEnd: user.subscriptionEnd, warning: daysLeft > 0 && daysLeft <= 7 };
}

// ─── TRIAL ───────────────────────────────────────────────────────────────────
app.get('/api/trial', (req, res) => res.json(getTrialInfo(req)));

// ─── AUTH ────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  await getDB();
  const { email, password } = req.body;
  const users = await query('SELECT * FROM users WHERE email = ? AND actif = 1', [email]);
  if (!users.length) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  const user = users[0];
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  const token = jwt.sign({ id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role, ecole_id: user.ecole_id || 1 }, SECRET, { expiresIn: '24h' });
  res.cookie('token', token, { httpOnly: true, maxAge: 86400000 });
  res.json({ token, user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role, ecole_id: user.ecole_id || 1 } });
});

app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

app.get('/api/me', authMiddleware, async (req, res) => {
  const users = await query('SELECT id, nom, prenom, email, role, telephone, ecole_id, notif_notes, notif_presences, notif_factures, notif_messages FROM users WHERE id = ?', [req.user.id]);
  res.json(users[0]);
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  await getDB();
  const eid = req.user.ecole_id || 1;
  const totalEleves = await query('SELECT COUNT(*) as n FROM eleves e JOIN users u ON e.user_id=u.id WHERE u.ecole_id=? AND e.statut="actif"', [eid]);
  const totalProfs = await query('SELECT COUNT(*) as n FROM profs p JOIN users u ON p.user_id=u.id WHERE u.ecole_id=?', [eid]);
  const totalClasses = await query('SELECT COUNT(*) as n FROM classes WHERE ecole_id=?', [eid]);
  const facturesImpayees = await query('SELECT COUNT(*) as n, COALESCE(SUM(montant-montant_paye),0) as total FROM factures f JOIN eleves e ON f.eleve_id=e.id JOIN users u ON e.user_id=u.id WHERE u.ecole_id=? AND f.statut IN ("impayee","partielle")', [eid]);
  const absencesToday = await query("SELECT COUNT(*) as n FROM presences p JOIN eleves e ON p.eleve_id=e.id JOIN users u ON e.user_id=u.id WHERE u.ecole_id=? AND p.date=date('now') AND p.statut='absent'", [eid]);
  const annonces = await query('SELECT a.*, u.nom, u.prenom FROM annonces a JOIN users u ON a.auteur_id=u.id WHERE a.ecole_id=? AND a.actif=1 ORDER BY a.date_publication DESC LIMIT 5', [eid]);
  const recentsFactures = await query('SELECT f.*, u.nom, u.prenom FROM factures f JOIN eleves e ON f.eleve_id=e.id JOIN users u ON e.user_id=u.id WHERE u.ecole_id=? ORDER BY f.date_emission DESC LIMIT 5', [eid]);
  const topEleves = await query('SELECT u.nom, u.prenom, c.nom as classe, ROUND(AVG(n.valeur/n.sur*20),2) as moyenne FROM notes n JOIN eleves e ON n.eleve_id=e.id JOIN users u ON e.user_id=u.id JOIN classes c ON e.classe_id=c.id WHERE u.ecole_id=? GROUP BY n.eleve_id ORDER BY moyenne DESC LIMIT 5', [eid]);
  const revenueMonth = await query("SELECT COALESCE(SUM(montant_paye),0) as total FROM factures f JOIN eleves e ON f.eleve_id=e.id JOIN users u ON e.user_id=u.id WHERE u.ecole_id=? AND strftime('%Y-%m',f.date_emission)=strftime('%Y-%m',date('now'))", [eid]);
  const notifCount = await query('SELECT COUNT(*) as n FROM notifications WHERE user_id=? AND lu=0', [req.user.id]);
  const msgCount = await query('SELECT COUNT(*) as n FROM messages WHERE destinataire_id=? AND lu=0', [req.user.id]);
  res.json({
    totalEleves: totalEleves[0].n, totalProfs: totalProfs[0].n, totalClasses: totalClasses[0].n,
    facturesImpayees: facturesImpayees[0].n, totalImpaye: facturesImpayees[0].total,
    absencesToday: absencesToday[0].n, annonces, recentsFactures, topEleves,
    revenueMonth: revenueMonth[0].total, notifCount: notifCount[0].n, msgCount: msgCount[0].n
  });
});

// ─── CLASSES ─────────────────────────────────────────────────────────────────
app.get('/api/classes', authMiddleware, async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const rows = await query('SELECT c.*, n.nom as niveau_nom, u.nom as prof_nom, u.prenom as prof_prenom, (SELECT COUNT(*) FROM eleves e2 WHERE e2.classe_id=c.id AND e2.statut="actif") as nb_eleves FROM classes c LEFT JOIN niveaux n ON c.niveau_id=n.id LEFT JOIN users u ON c.prof_principal_id=u.id WHERE c.ecole_id=? ORDER BY c.nom', [eid]);
  res.json(rows);
});

app.post('/api/classes', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const { nom, niveau_id, prof_principal_id, annee_scolaire, max_eleves } = req.body;
  await run('INSERT INTO classes (ecole_id, nom, niveau_id, prof_principal_id, annee_scolaire, max_eleves) VALUES (?,?,?,?,?,?)', [eid, nom, niveau_id, prof_principal_id, annee_scolaire || '2024-2025', max_eleves || 35]);
  res.json({ ok: true });
});

app.put('/api/classes/:id', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const { nom, niveau_id, prof_principal_id, annee_scolaire, max_eleves } = req.body;
  await run('UPDATE classes SET nom=?, niveau_id=?, prof_principal_id=?, annee_scolaire=?, max_eleves=? WHERE id=?', [nom, niveau_id, prof_principal_id, annee_scolaire, max_eleves, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/classes/:id', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  await run('DELETE FROM classes WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/niveaux', authMiddleware, async (req, res) => {
  const eid = req.user.ecole_id || 1;
  res.json(await query('SELECT * FROM niveaux WHERE ecole_id=? ORDER BY ordre', [eid]));
});

// ─── ÉLÈVES ──────────────────────────────────────────────────────────────────
app.get('/api/eleves', authMiddleware, async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const rows = await query(`SELECT e.*, u.nom, u.prenom, u.email, u.telephone, u.actif,
    c.nom as classe_nom, pu.nom as parent_nom, pu.prenom as parent_prenom, pu.telephone as parent_tel
    FROM eleves e JOIN users u ON e.user_id=u.id LEFT JOIN classes c ON e.classe_id=c.id LEFT JOIN users pu ON e.parent_id=pu.id
    WHERE u.ecole_id=? ORDER BY u.nom`, [eid]);
  res.json(rows);
});

app.post('/api/eleves', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const { nom, prenom, email, password, telephone, classe_id, parent_id, date_naissance, adresse } = req.body;
  const existing = await query('SELECT id FROM users WHERE email=?', [email]);
  if (existing.length) return res.status(400).json({ error: 'Email déjà utilisé' });
  const hashed = bcrypt.hashSync(password || 'eleve123', 10);
  const userRes = await run('INSERT INTO users (ecole_id, nom, prenom, email, password, role, telephone, date_naissance, adresse) VALUES (?,?,?,?,?,?,?,?,?)', [eid, nom, prenom, email, hashed, 'eleve', telephone, date_naissance, adresse]);
  const mat = 'MAT-' + new Date().getFullYear() + '-' + String(userRes.lastInsertRowid).padStart(3,'0');
  await run('INSERT INTO eleves (user_id, classe_id, numero_matricule, parent_id, date_inscription) VALUES (?,?,?,?,date("now"))', [userRes.lastInsertRowid, classe_id, mat, parent_id]);
  res.json({ ok: true });
});

app.put('/api/eleves/:id', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const { nom, prenom, email, telephone, classe_id, parent_id, date_naissance, adresse, statut } = req.body;
  const eleve = await query('SELECT * FROM eleves WHERE id=?', [req.params.id]);
  if (!eleve.length) return res.status(404).json({ error: 'Élève non trouvé' });
  await run('UPDATE users SET nom=?, prenom=?, email=?, telephone=?, date_naissance=?, adresse=? WHERE id=?', [nom, prenom, email, telephone, date_naissance, adresse, eleve[0].user_id]);
  await run('UPDATE eleves SET classe_id=?, parent_id=?, statut=? WHERE id=?', [classe_id, parent_id, statut || 'actif', req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/eleves/:id', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const eleve = await query('SELECT * FROM eleves WHERE id=?', [req.params.id]);
  if (!eleve.length) return res.status(404).json({ error: 'Élève non trouvé' });
  await run('UPDATE users SET actif=0 WHERE id=?', [eleve[0].user_id]);
  await run("UPDATE eleves SET statut='inactif' WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});

// ─── PROFS ────────────────────────────────────────────────────────────────────
app.get('/api/profs', authMiddleware, async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const rows = await query(`SELECT p.*, u.nom, u.prenom, u.email, u.telephone, u.actif, u.created_at,
    GROUP_CONCAT(m.nom) as matieres_noms
    FROM profs p JOIN users u ON p.user_id=u.id
    LEFT JOIN prof_matieres pm ON pm.prof_id=p.id LEFT JOIN matieres m ON m.id=pm.matiere_id
    WHERE u.ecole_id=? GROUP BY p.id ORDER BY u.nom`, [eid]);
  res.json(rows);
});

app.post('/api/profs', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const { nom, prenom, email, password, telephone, specialite, cin, date_embauche, salaire } = req.body;
  const existing = await query('SELECT id FROM users WHERE email=?', [email]);
  if (existing.length) return res.status(400).json({ error: 'Email déjà utilisé' });
  const hashed = bcrypt.hashSync(password || 'prof123', 10);
  const userRes = await run('INSERT INTO users (ecole_id, nom, prenom, email, password, role, telephone) VALUES (?,?,?,?,?,?,?)', [eid, nom, prenom, email, hashed, 'prof', telephone]);
  await run('INSERT INTO profs (user_id, specialite, cin, date_embauche, salaire) VALUES (?,?,?,?,?)', [userRes.lastInsertRowid, specialite, cin, date_embauche, salaire]);
  res.json({ ok: true });
});

app.put('/api/profs/:id', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const { nom, prenom, email, telephone, specialite, cin, date_embauche, salaire } = req.body;
  const prof = await query('SELECT * FROM profs WHERE id=?', [req.params.id]);
  if (!prof.length) return res.status(404).json({ error: 'Prof non trouvé' });
  await run('UPDATE users SET nom=?, prenom=?, email=?, telephone=? WHERE id=?', [nom, prenom, email, telephone, prof[0].user_id]);
  await run('UPDATE profs SET specialite=?, cin=?, date_embauche=?, salaire=? WHERE id=?', [specialite, cin, date_embauche, salaire, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/profs/:id', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const prof = await query('SELECT * FROM profs WHERE id=?', [req.params.id]);
  if (!prof.length) return res.status(404).json({ error: 'Prof non trouvé' });
  await run('UPDATE users SET actif=0 WHERE id=?', [prof[0].user_id]);
  res.json({ ok: true });
});

// ─── MATIÈRES ────────────────────────────────────────────────────────────────
app.get('/api/matieres', authMiddleware, async (req, res) => {
  const eid = req.user.ecole_id || 1;
  res.json(await query('SELECT * FROM matieres WHERE ecole_id=? ORDER BY nom', [eid]));
});

app.post('/api/matieres', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const { nom, coefficient, couleur } = req.body;
  await run('INSERT INTO matieres (ecole_id, nom, coefficient, couleur) VALUES (?,?,?,?)', [eid, nom, coefficient || 1, couleur || '#3B82F6']);
  res.json({ ok: true });
});

// ─── EMPLOI DU TEMPS ─────────────────────────────────────────────────────────
app.get('/api/emploi', authMiddleware, async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const { classe_id, prof_id } = req.query;
  let sql = `SELECT e.*, m.nom as matiere_nom, m.couleur, c.nom as classe_nom, u.nom as prof_nom, u.prenom as prof_prenom
    FROM emploi_du_temps e JOIN matieres m ON e.matiere_id=m.id JOIN classes c ON e.classe_id=c.id
    JOIN profs p ON e.prof_id=p.id JOIN users u ON p.user_id=u.id WHERE e.ecole_id=?`;
  const params = [eid];
  if (classe_id) { sql += ' AND e.classe_id=?'; params.push(classe_id); }
  if (prof_id) { sql += ' AND e.prof_id=?'; params.push(prof_id); }
  sql += ' ORDER BY CASE e.jour WHEN "Lundi" THEN 1 WHEN "Mardi" THEN 2 WHEN "Mercredi" THEN 3 WHEN "Jeudi" THEN 4 WHEN "Vendredi" THEN 5 WHEN "Samedi" THEN 6 ELSE 7 END, e.heure_debut';
  res.json(await query(sql, params));
});

app.post('/api/emploi', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const { classe_id, matiere_id, prof_id, jour, heure_debut, heure_fin, salle } = req.body;
  // Vérifier conflit
  const conflict = await query('SELECT id FROM emploi_du_temps WHERE ecole_id=? AND prof_id=? AND jour=? AND ((heure_debut < ? AND heure_fin > ?) OR (heure_debut < ? AND heure_fin > ?) OR (heure_debut >= ? AND heure_fin <= ?))', [eid, prof_id, jour, heure_fin, heure_debut, heure_fin, heure_debut, heure_debut, heure_fin]);
  if (conflict.length) return res.status(400).json({ error: 'Ce professeur a déjà un cours sur ce créneau' });
  await run('INSERT INTO emploi_du_temps (ecole_id, classe_id, matiere_id, prof_id, jour, heure_debut, heure_fin, salle) VALUES (?,?,?,?,?,?,?,?)', [eid, classe_id, matiere_id, prof_id, jour, heure_debut, heure_fin, salle]);
  res.json({ ok: true });
});

app.put('/api/emploi/:id', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const { classe_id, matiere_id, prof_id, jour, heure_debut, heure_fin, salle } = req.body;
  await run('UPDATE emploi_du_temps SET classe_id=?, matiere_id=?, prof_id=?, jour=?, heure_debut=?, heure_fin=?, salle=? WHERE id=?', [classe_id, matiere_id, prof_id, jour, heure_debut, heure_fin, salle, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/emploi/:id', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  await run('DELETE FROM emploi_du_temps WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ─── PRÉSENCES ───────────────────────────────────────────────────────────────
app.get('/api/presences', authMiddleware, async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const { classe_id, date, eleve_id } = req.query;
  let sql = `SELECT p.*, u.nom, u.prenom, c.nom as classe_nom, m.nom as matiere_nom
    FROM presences p JOIN eleves e ON p.eleve_id=e.id JOIN users u ON e.user_id=u.id
    LEFT JOIN classes c ON e.classe_id=c.id LEFT JOIN matieres m ON p.matiere_id=m.id WHERE u.ecole_id=?`;
  const params = [eid];
  if (classe_id) { sql += ' AND e.classe_id=?'; params.push(classe_id); }
  if (date) { sql += ' AND p.date=?'; params.push(date); }
  if (eleve_id) { sql += ' AND p.eleve_id=?'; params.push(eleve_id); }
  sql += ' ORDER BY p.date DESC, u.nom';
  res.json(await query(sql, params));
});

app.post('/api/presences', authMiddleware, async (req, res) => {
  const { presences } = req.body;
  for (const p of presences) {
    const existing = await query('SELECT id FROM presences WHERE eleve_id=? AND date=? AND matiere_id=?', [p.eleve_id, p.date, p.matiere_id || null]);
    if (existing.length) {
      await run('UPDATE presences SET statut=?, remarque=? WHERE id=?', [p.statut, p.remarque || '', existing[0].id]);
    } else {
      await run('INSERT INTO presences (eleve_id, date, statut, matiere_id, remarque, saisi_par) VALUES (?,?,?,?,?,?)', [p.eleve_id, p.date, p.statut, p.matiere_id || null, p.remarque || '', req.user.id]);
    }
    // Notifier parent si absent
    if (p.statut === 'absent') {
      const eleve = await query('SELECT e.parent_id, u.nom, u.prenom FROM eleves e JOIN users u ON e.user_id=u.id WHERE e.id=?', [p.eleve_id]);
      if (eleve.length && eleve[0].parent_id) {
        await run('INSERT INTO notifications (ecole_id, user_id, type, titre, message) VALUES (?,?,?,?,?)', [req.user.ecole_id || 1, eleve[0].parent_id, 'absence', 'Absence signalée', `Votre enfant ${eleve[0].prenom} ${eleve[0].nom} était absent(e) le ${p.date}`]);
      }
    }
  }
  res.json({ ok: true });
});

// ─── NOTES ───────────────────────────────────────────────────────────────────
app.get('/api/notes', authMiddleware, async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const { classe_id, eleve_id, periode_id, matiere_id } = req.query;
  let sql = `SELECT n.*, u.nom, u.prenom, m.nom as matiere_nom, m.coefficient, p.nom as periode_nom, c.nom as classe_nom
    FROM notes n JOIN eleves e ON n.eleve_id=e.id JOIN users u ON e.user_id=u.id
    JOIN matieres m ON n.matiere_id=m.id LEFT JOIN periodes p ON n.periode_id=p.id LEFT JOIN classes c ON e.classe_id=c.id WHERE u.ecole_id=?`;
  const params = [eid];
  if (classe_id) { sql += ' AND e.classe_id=?'; params.push(classe_id); }
  if (eleve_id) { sql += ' AND n.eleve_id=?'; params.push(eleve_id); }
  if (periode_id) { sql += ' AND n.periode_id=?'; params.push(periode_id); }
  if (matiere_id) { sql += ' AND n.matiere_id=?'; params.push(matiere_id); }
  sql += ' ORDER BY n.date_saisie DESC';
  res.json(await query(sql, params));
});

app.post('/api/notes', authMiddleware, requireRole('admin', 'prof', 'super'), async (req, res) => {
  const { eleve_id, matiere_id, periode_id, type_note, valeur, sur, remarque } = req.body;
  await run('INSERT INTO notes (eleve_id, matiere_id, periode_id, type_note, valeur, sur, remarque, saisi_par) VALUES (?,?,?,?,?,?,?,?)', [eleve_id, matiere_id, periode_id, type_note || 'devoir', valeur, sur || 20, remarque, req.user.id]);
  // Notifier élève
  const eleve = await query('SELECT e.user_id, u.nom, u.prenom FROM eleves e JOIN users u ON e.user_id=u.id WHERE e.id=?', [eleve_id]);
  const mat = await query('SELECT nom FROM matieres WHERE id=?', [matiere_id]);
  if (eleve.length) {
    await run('INSERT INTO notifications (ecole_id, user_id, type, titre, message) VALUES (?,?,?,?,?)', [req.user.ecole_id || 1, eleve[0].user_id, 'note', 'Nouvelle note', `Nouvelle note en ${mat[0]?.nom || 'matière'} : ${valeur}/${sur || 20}`]);
  }
  res.json({ ok: true });
});

app.delete('/api/notes/:id', authMiddleware, requireRole('admin', 'prof', 'super'), async (req, res) => {
  await run('DELETE FROM notes WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/periodes', authMiddleware, async (req, res) => {
  const eid = req.user.ecole_id || 1;
  res.json(await query('SELECT * FROM periodes WHERE ecole_id=? ORDER BY date_debut', [eid]));
});

// ─── FACTURATION ─────────────────────────────────────────────────────────────
app.get('/api/factures', authMiddleware, async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const { statut, eleve_id } = req.query;
  let sql = `SELECT f.*, u.nom, u.prenom, c.nom as classe_nom FROM factures f JOIN eleves e ON f.eleve_id=e.id JOIN users u ON e.user_id=u.id LEFT JOIN classes c ON e.classe_id=c.id WHERE u.ecole_id=?`;
  const params = [eid];
  if (statut) { sql += ' AND f.statut=?'; params.push(statut); }
  if (eleve_id) { sql += ' AND f.eleve_id=?'; params.push(eleve_id); }
  sql += ' ORDER BY f.date_emission DESC';
  res.json(await query(sql, params));
});

app.post('/api/factures', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const { eleve_id, description, montant, date_echeance } = req.body;
  const num = 'FAC-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4);
  await run('INSERT INTO factures (eleve_id, numero, description, montant, date_echeance) VALUES (?,?,?,?,?)', [eleve_id, num, description, montant, date_echeance]);
  // Notifier parent
  const eleve = await query('SELECT e.parent_id, u.nom, u.prenom FROM eleves e JOIN users u ON e.user_id=u.id WHERE e.id=?', [eleve_id]);
  if (eleve.length && eleve[0].parent_id) {
    await run('INSERT INTO notifications (ecole_id, user_id, type, titre, message) VALUES (?,?,?,?,?)', [req.user.ecole_id || 1, eleve[0].parent_id, 'facture', 'Nouvelle facture', `Nouvelle facture de ${montant} MAD pour ${eleve[0].prenom} ${eleve[0].nom}`]);
  }
  res.json({ ok: true });
});

app.put('/api/factures/:id', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const { description, montant, date_echeance, notes } = req.body;
  await run('UPDATE factures SET description=?, montant=?, date_echeance=?, notes=? WHERE id=?', [description, montant, date_echeance, notes, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/factures/:id', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  await run("UPDATE factures SET statut='annulee' WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});

app.post('/api/factures/:id/paiement', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const { montant, mode, reference, notes } = req.body;
  const facture = await query('SELECT * FROM factures WHERE id=?', [req.params.id]);
  if (!facture.length) return res.status(404).json({ error: 'Facture non trouvée' });
  const f = facture[0];
  const newPaye = (f.montant_paye || 0) + parseFloat(montant);
  const newStatut = newPaye >= f.montant ? 'payee' : 'partielle';
  await run('UPDATE factures SET montant_paye=?, statut=?, date_paiement=date("now"), mode_paiement=? WHERE id=?', [newPaye, newStatut, mode, req.params.id]);
  await run('INSERT INTO paiements (facture_id, montant, mode, reference, notes, saisi_par) VALUES (?,?,?,?,?,?)', [req.params.id, montant, mode, reference, notes, req.user.id]);
  res.json({ ok: true, statut: newStatut });
});

app.get('/api/factures/stats/summary', authMiddleware, async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const summary = await query(`SELECT SUM(f.montant) as total_emis, SUM(f.montant_paye) as total_paye, SUM(f.montant-f.montant_paye) as total_impaye, COUNT(*) as nb_total, SUM(CASE WHEN f.statut='payee' THEN 1 ELSE 0 END) as nb_payees, SUM(CASE WHEN f.statut='impayee' THEN 1 ELSE 0 END) as nb_impayees, SUM(CASE WHEN f.statut='partielle' THEN 1 ELSE 0 END) as nb_partielles FROM factures f JOIN eleves e ON f.eleve_id=e.id JOIN users u ON e.user_id=u.id WHERE u.ecole_id=? AND f.statut != 'annulee'`, [eid]);
  res.json(summary[0]);
});

// ─── ANNONCES ────────────────────────────────────────────────────────────────
app.get('/api/annonces', authMiddleware, async (req, res) => {
  const eid = req.user.ecole_id || 1;
  res.json(await query('SELECT a.*, u.nom, u.prenom FROM annonces a JOIN users u ON a.auteur_id=u.id WHERE a.ecole_id=? AND a.actif=1 ORDER BY a.date_publication DESC', [eid]));
});

app.post('/api/annonces', authMiddleware, requireRole('admin', 'prof', 'super'), async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const { titre, contenu, destinataires } = req.body;
  await run('INSERT INTO annonces (ecole_id, titre, contenu, auteur_id, destinataires) VALUES (?,?,?,?,?)', [eid, titre, contenu, req.user.id, destinataires]);
  res.json({ ok: true });
});

app.delete('/api/annonces/:id', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  await run('UPDATE annonces SET actif=0 WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ─── MESSAGERIE ──────────────────────────────────────────────────────────────
app.get('/api/messages', authMiddleware, async (req, res) => {
  const { type } = req.query; // inbox | sent
  let sql, params;
  if (type === 'sent') {
    sql = `SELECT m.*, u.nom as dest_nom, u.prenom as dest_prenom FROM messages m JOIN users u ON m.destinataire_id=u.id WHERE m.expediteur_id=? ORDER BY m.date_envoi DESC`;
    params = [req.user.id];
  } else {
    sql = `SELECT m.*, u.nom as exp_nom, u.prenom as exp_prenom FROM messages m JOIN users u ON m.expediteur_id=u.id WHERE m.destinataire_id=? ORDER BY m.date_envoi DESC`;
    params = [req.user.id];
  }
  res.json(await query(sql, params));
});

app.post('/api/messages', authMiddleware, async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const { destinataire_id, sujet, contenu } = req.body;
  await run('INSERT INTO messages (ecole_id, expediteur_id, destinataire_id, sujet, contenu) VALUES (?,?,?,?,?)', [eid, req.user.id, destinataire_id, sujet, contenu]);
  await run('INSERT INTO notifications (ecole_id, user_id, type, titre, message) VALUES (?,?,?,?,?)', [eid, destinataire_id, 'message', 'Nouveau message', `Message de ${req.user.prenom} ${req.user.nom} : ${sujet}`]);
  res.json({ ok: true });
});

app.put('/api/messages/:id/lu', authMiddleware, async (req, res) => {
  await run('UPDATE messages SET lu=1 WHERE id=? AND destinataire_id=?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

app.get('/api/messages/contacts', authMiddleware, async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const rows = await query('SELECT id, nom, prenom, role FROM users WHERE ecole_id=? AND actif=1 AND id!=? ORDER BY nom', [eid, req.user.id]);
  res.json(rows);
});

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
app.get('/api/notifications', authMiddleware, async (req, res) => {
  const rows = await query('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  res.json(rows);
});

app.put('/api/notifications/:id/lu', authMiddleware, async (req, res) => {
  await run('UPDATE notifications SET lu=1 WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

app.put('/api/notifications/all/lu', authMiddleware, async (req, res) => {
  await run('UPDATE notifications SET lu=1 WHERE user_id=?', [req.user.id]);
  res.json({ ok: true });
});

// ─── PROFIL UTILISATEUR ───────────────────────────────────────────────────────
app.put('/api/users/:id/password', authMiddleware, async (req, res) => {
  if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin' && req.user.role !== 'super') return res.status(403).json({ error: 'Accès refusé' });
  const { currentPassword, password } = req.body;
  if (currentPassword) {
    const users = await query('SELECT password FROM users WHERE id=?', [req.user.id]);
    if (!users.length || !bcrypt.compareSync(currentPassword, users[0].password)) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  }
  const hashed = bcrypt.hashSync(password, 10);
  await run('UPDATE users SET password=? WHERE id=?', [hashed, req.params.id]);
  res.json({ ok: true });
});

app.put('/api/users/:id/notifs', authMiddleware, async (req, res) => {
  const { notif_notes, notif_presences, notif_factures, notif_messages } = req.body;
  await run('UPDATE users SET notif_notes=?, notif_presences=?, notif_factures=?, notif_messages=? WHERE id=?', [notif_notes ? 1 : 0, notif_presences ? 1 : 0, notif_factures ? 1 : 0, notif_messages ? 1 : 0, req.params.id]);
  res.json({ ok: true });
});

// ─── SUPER ADMIN — ÉCOLES ────────────────────────────────────────────────────
app.get('/api/super/ecoles', authMiddleware, requireRole('super'), async (req, res) => {
  const ecoles = await query('SELECT e.*, (SELECT COUNT(*) FROM users u WHERE u.ecole_id=e.id AND u.role="admin") as nb_admins, (SELECT COUNT(*) FROM users u WHERE u.ecole_id=e.id AND u.role="eleve") as nb_eleves FROM ecoles e ORDER BY e.created_at DESC');
  res.json(ecoles);
});

app.post('/api/super/ecoles', authMiddleware, requireRole('super'), async (req, res) => {
  const { nom, slug, adresse, telephone, email, abonnement, abonnement_fin, lifetime } = req.body;
  const existing = await query('SELECT id FROM ecoles WHERE slug=?', [slug]);
  if (existing.length) return res.status(400).json({ error: 'Slug déjà utilisé' });
  await run('INSERT INTO ecoles (nom, slug, adresse, telephone, email, abonnement, abonnement_fin, lifetime) VALUES (?,?,?,?,?,?,?,?)', [nom, slug, adresse, telephone, email, abonnement || 'trial', abonnement_fin, lifetime ? 1 : 0]);
  res.json({ ok: true });
});

app.put('/api/super/ecoles/:id', authMiddleware, requireRole('super'), async (req, res) => {
  const { nom, adresse, telephone, email, abonnement, abonnement_fin, lifetime, actif } = req.body;
  await run('UPDATE ecoles SET nom=?, adresse=?, telephone=?, email=?, abonnement=?, abonnement_fin=?, lifetime=?, actif=? WHERE id=?', [nom, adresse, telephone, email, abonnement, abonnement_fin, lifetime ? 1 : 0, actif ? 1 : 0, req.params.id]);
  res.json({ ok: true });
});

app.get('/api/super/stats', authMiddleware, requireRole('super'), async (req, res) => {
  const totalEcoles = await query('SELECT COUNT(*) as n FROM ecoles WHERE actif=1');
  const totalUsers = await query('SELECT COUNT(*) as n FROM users WHERE actif=1 AND role != "super"');
  const totalEleves = await query('SELECT COUNT(*) as n FROM eleves WHERE statut="actif"');
  const ecolesByAbonnement = await query('SELECT abonnement, COUNT(*) as n FROM ecoles GROUP BY abonnement');
  const recentEcoles = await query('SELECT * FROM ecoles ORDER BY created_at DESC LIMIT 5');
  res.json({ totalEcoles: totalEcoles[0].n, totalUsers: totalUsers[0].n, totalEleves: totalEleves[0].n, ecolesByAbonnement, recentEcoles });
});

app.get('/api/users', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  const eid = req.user.ecole_id || 1;
  let rows;
  if (req.user.role === 'super') {
    rows = await query('SELECT id, nom, prenom, email, role, telephone, actif, subscriptionEnd, lifetime, ecole_id, created_at FROM users ORDER BY nom');
  } else {
    rows = await query('SELECT id, nom, prenom, email, role, telephone, actif, subscriptionEnd, lifetime, ecole_id, created_at FROM users WHERE ecole_id=? ORDER BY nom', [eid]);
  }
  res.json(rows.map(u => ({ ...u, subscription: getSubscriptionInfo(u) })));
});

app.post('/api/users', authMiddleware, requireRole('super', 'admin'), async (req, res) => {
  const eid = req.user.ecole_id || 1;
  const { nom, prenom, email, password, role, telephone } = req.body;
  if (!nom || !prenom || !email || !password) return res.status(400).json({ error: 'Champs manquants' });
  const existing = await query('SELECT id FROM users WHERE email=?', [email]);
  if (existing.length) return res.status(400).json({ error: 'Email déjà utilisé' });
  const hashed = bcrypt.hashSync(password, 10);
  await run('INSERT INTO users (ecole_id, nom, prenom, email, password, role, telephone) VALUES (?,?,?,?,?,?,?)', [eid, nom, prenom, email, hashed, role || 'admin', telephone || '']);
  res.json({ ok: true });
});

app.delete('/api/users/:id', authMiddleware, requireRole('super'), async (req, res) => {
  const id = parseInt(req.params.id);
  const superUser = await query('SELECT id FROM users WHERE role="super" ORDER BY id LIMIT 1');
  if (superUser.length && superUser[0].id === id) return res.status(400).json({ error: 'Impossible de supprimer le super admin' });
  await run('UPDATE users SET actif=0 WHERE id=?', [id]);
  res.json({ ok: true });
});

app.put('/api/users/:id/reset-password', authMiddleware, requireRole('super'), async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mot de passe trop court' });
  await run('UPDATE users SET password=? WHERE id=?', [bcrypt.hashSync(newPassword, 10), req.params.id]);
  res.json({ ok: true });
});

app.put('/api/users/:id/lifetime', authMiddleware, requireRole('super'), async (req, res) => {
  const users = await query('SELECT * FROM users WHERE id=?', [req.params.id]);
  if (!users.length) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  const newLifetime = users[0].lifetime ? 0 : 1;
  await run('UPDATE users SET lifetime=? WHERE id=?', [newLifetime, req.params.id]);
  res.json({ ok: true, lifetime: newLifetime === 1 });
});

app.put('/api/users/:id/renew', authMiddleware, requireRole('super'), async (req, res) => {
  const { months } = req.body;
  const days = (months || 1) * 30;
  const users = await query('SELECT * FROM users WHERE id=?', [req.params.id]);
  if (!users.length) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  const now = Date.now();
  const currentEnd = users[0].subscriptionEnd ? new Date(users[0].subscriptionEnd).getTime() : now;
  const newEnd = new Date(Math.max(now, currentEnd) + days * 86400000).toISOString();
  await run('UPDATE users SET subscriptionEnd=? WHERE id=?', [newEnd, req.params.id]);
  res.json({ ok: true, subscriptionEnd: newEnd });
});

app.get('/api/subscription', authMiddleware, async (req, res) => {
  if (req.user.role === 'super') return res.json({ unlimited: true });
  const users = await query('SELECT * FROM users WHERE id=?', [req.user.id]);
  if (!users.length) return res.json({ expired: true });
  res.json(getSubscriptionInfo(users[0]));
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
  };
  res.setHeader('Content-Disposition', 'attachment; filename=madrasati_backup_' + new Date().toISOString().slice(0,10) + '.json');
  res.json(data);
});

app.post('/api/reset', authMiddleware, requireRole('admin', 'super'), async (req, res) => {
  try {
    const tables = ['paiements','notes','presences','emploi_du_temps','prof_matieres','factures','annonces','messages','notifications','eleves','profs','classes','matieres','niveaux','periodes'];
    for (const t of tables) { try { await run(`DELETE FROM ${t}`); } catch(e) {} }
    await run("DELETE FROM users WHERE role NOT IN ('super','admin','demo')");
    saveDB();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── PAGE ADMIN & STATIC ───────────────────────────────────────────────────────
app.get('/admin', (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.redirect('/');
  try {
    const user = jwt.verify(token, SECRET);
    if (user.role !== 'super') return res.redirect('/');
    res.sendFile(path.join(__dirname, '../public/admin.html'));
  } catch(e) { res.redirect('/'); }
});

app.get('/api/reset-db-secret-2026', async (req, res) => {
  try {
    const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '../data');
    const dbPath = require('path').join(DATA_DIR, 'madrasati.db');
    if (require('fs').existsSync(dbPath)) require('fs').unlinkSync(dbPath);
    if (resetDB) resetDB();
    res.send('<h2 style="font-family:sans-serif;padding:20px;color:green">✅ Base réinitialisée ! <a href="/">Cliquez ici</a></h2>');
  } catch(e) { res.status(500).send('<h2 style="color:red">Erreur: ' + e.message + '</h2>'); }
});

app.get('/presentation', (req, res) => res.sendFile(path.join(__dirname, '../public/presentation.html')));
app.get('/cgu', (req, res) => res.sendFile(path.join(__dirname, '../public/cgu.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

const PORT = process.env.PORT || 3000;
getDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n✅ Madrasati v2 démarré sur http://localhost:${PORT}`);
    console.log(`   Admin  : admin@madrasati.ma / admin123`);
    console.log(`   Super  : super@madrasati.ma / super2026\n`);
  });
}).catch(err => console.error('Erreur DB:', err));
