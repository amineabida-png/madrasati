const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? process.env.RAILWAY_VOLUME_MOUNT_PATH
  : path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'madrasati.db');

let db = null;

async function getDB() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    runMigrations(db);
    saveDB();
  } else {
    db = new SQL.Database();
    await initSchema(db);
    await seedData(db);
    saveDB();
  }
  return db;
}

function runMigrations(db) {
  const migrations = [
    "ALTER TABLE users ADD COLUMN subscriptionEnd TEXT",
    "ALTER TABLE users ADD COLUMN lifetime INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN ecole_id INTEGER DEFAULT 1",
    `CREATE TABLE IF NOT EXISTS ecoles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      adresse TEXT,
      telephone TEXT,
      email TEXT,
      logo TEXT,
      couleur_primaire TEXT DEFAULT '#1a2b4a',
      abonnement TEXT DEFAULT 'trial',
      abonnement_fin TEXT,
      lifetime INTEGER DEFAULT 0,
      actif INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecole_id INTEGER DEFAULT 1,
      expediteur_id INTEGER NOT NULL,
      destinataire_id INTEGER NOT NULL,
      sujet TEXT NOT NULL,
      contenu TEXT NOT NULL,
      lu INTEGER DEFAULT 0,
      date_envoi TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(expediteur_id) REFERENCES users(id),
      FOREIGN KEY(destinataire_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecole_id INTEGER DEFAULT 1,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      titre TEXT NOT NULL,
      message TEXT,
      lu INTEGER DEFAULT 0,
      lien TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
    "ALTER TABLE users ADD COLUMN push_token TEXT",
    "ALTER TABLE users ADD COLUMN notif_notes INTEGER DEFAULT 1",
    "ALTER TABLE users ADD COLUMN notif_presences INTEGER DEFAULT 1",
    "ALTER TABLE users ADD COLUMN notif_factures INTEGER DEFAULT 1",
    "ALTER TABLE users ADD COLUMN notif_messages INTEGER DEFAULT 1",
  ];
  for (const m of migrations) {
    try { db.run(m); } catch(e) {}
  }
}

function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, buffer);
}

async function initSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS ecoles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      adresse TEXT,
      telephone TEXT,
      email TEXT,
      logo TEXT,
      couleur_primaire TEXT DEFAULT '#1a2b4a',
      abonnement TEXT DEFAULT 'trial',
      abonnement_fin TEXT,
      lifetime INTEGER DEFAULT 0,
      actif INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecole_id INTEGER DEFAULT 1,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('super','admin','prof','eleve','parent')),
      telephone TEXT,
      adresse TEXT,
      date_naissance TEXT,
      photo TEXT,
      actif INTEGER DEFAULT 1,
      subscriptionEnd TEXT,
      lifetime INTEGER DEFAULT 0,
      push_token TEXT,
      notif_notes INTEGER DEFAULT 1,
      notif_presences INTEGER DEFAULT 1,
      notif_factures INTEGER DEFAULT 1,
      notif_messages INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS niveaux (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecole_id INTEGER DEFAULT 1,
      nom TEXT NOT NULL,
      ordre INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecole_id INTEGER DEFAULT 1,
      nom TEXT NOT NULL,
      niveau_id INTEGER,
      prof_principal_id INTEGER,
      annee_scolaire TEXT DEFAULT '2024-2025',
      max_eleves INTEGER DEFAULT 35,
      FOREIGN KEY(niveau_id) REFERENCES niveaux(id),
      FOREIGN KEY(prof_principal_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS eleves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      classe_id INTEGER,
      numero_matricule TEXT UNIQUE,
      parent_id INTEGER,
      date_inscription TEXT,
      statut TEXT DEFAULT 'actif',
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(classe_id) REFERENCES classes(id),
      FOREIGN KEY(parent_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS profs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      specialite TEXT,
      cin TEXT,
      date_embauche TEXT,
      salaire REAL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS matieres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecole_id INTEGER DEFAULT 1,
      nom TEXT NOT NULL,
      coefficient REAL DEFAULT 1,
      couleur TEXT DEFAULT '#3B82F6'
    );

    CREATE TABLE IF NOT EXISTS prof_matieres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prof_id INTEGER,
      matiere_id INTEGER,
      classe_id INTEGER,
      FOREIGN KEY(prof_id) REFERENCES profs(id),
      FOREIGN KEY(matiere_id) REFERENCES matieres(id),
      FOREIGN KEY(classe_id) REFERENCES classes(id)
    );

    CREATE TABLE IF NOT EXISTS emploi_du_temps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecole_id INTEGER DEFAULT 1,
      classe_id INTEGER,
      matiere_id INTEGER,
      prof_id INTEGER,
      jour TEXT NOT NULL,
      heure_debut TEXT NOT NULL,
      heure_fin TEXT NOT NULL,
      salle TEXT,
      FOREIGN KEY(classe_id) REFERENCES classes(id),
      FOREIGN KEY(matiere_id) REFERENCES matieres(id),
      FOREIGN KEY(prof_id) REFERENCES profs(id)
    );

    CREATE TABLE IF NOT EXISTS presences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eleve_id INTEGER,
      date TEXT NOT NULL,
      statut TEXT NOT NULL CHECK(statut IN ('present','absent','retard','excuse')),
      matiere_id INTEGER,
      remarque TEXT,
      saisi_par INTEGER,
      FOREIGN KEY(eleve_id) REFERENCES eleves(id),
      FOREIGN KEY(matiere_id) REFERENCES matieres(id),
      FOREIGN KEY(saisi_par) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS periodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecole_id INTEGER DEFAULT 1,
      nom TEXT NOT NULL,
      annee_scolaire TEXT DEFAULT '2024-2025',
      date_debut TEXT,
      date_fin TEXT
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eleve_id INTEGER,
      matiere_id INTEGER,
      periode_id INTEGER,
      type_note TEXT DEFAULT 'devoir',
      valeur REAL NOT NULL,
      sur REAL DEFAULT 20,
      date_saisie TEXT DEFAULT (date('now')),
      remarque TEXT,
      saisi_par INTEGER,
      FOREIGN KEY(eleve_id) REFERENCES eleves(id),
      FOREIGN KEY(matiere_id) REFERENCES matieres(id),
      FOREIGN KEY(periode_id) REFERENCES periodes(id)
    );

    CREATE TABLE IF NOT EXISTS annonces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecole_id INTEGER DEFAULT 1,
      titre TEXT NOT NULL,
      contenu TEXT NOT NULL,
      auteur_id INTEGER,
      destinataires TEXT DEFAULT 'tous',
      date_publication TEXT DEFAULT (datetime('now')),
      actif INTEGER DEFAULT 1,
      FOREIGN KEY(auteur_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS factures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eleve_id INTEGER,
      numero TEXT UNIQUE NOT NULL,
      description TEXT,
      montant REAL NOT NULL,
      montant_paye REAL DEFAULT 0,
      statut TEXT DEFAULT 'impayee' CHECK(statut IN ('payee','impayee','partielle','annulee')),
      date_emission TEXT DEFAULT (date('now')),
      date_echeance TEXT,
      date_paiement TEXT,
      mode_paiement TEXT,
      notes TEXT,
      FOREIGN KEY(eleve_id) REFERENCES eleves(id)
    );

    CREATE TABLE IF NOT EXISTS paiements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facture_id INTEGER,
      montant REAL NOT NULL,
      date_paiement TEXT DEFAULT (date('now')),
      mode TEXT DEFAULT 'especes',
      reference TEXT,
      notes TEXT,
      saisi_par INTEGER,
      FOREIGN KEY(facture_id) REFERENCES factures(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecole_id INTEGER DEFAULT 1,
      expediteur_id INTEGER NOT NULL,
      destinataire_id INTEGER NOT NULL,
      sujet TEXT NOT NULL,
      contenu TEXT NOT NULL,
      lu INTEGER DEFAULT 0,
      date_envoi TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(expediteur_id) REFERENCES users(id),
      FOREIGN KEY(destinataire_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecole_id INTEGER DEFAULT 1,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      titre TEXT NOT NULL,
      message TEXT,
      lu INTEGER DEFAULT 0,
      lien TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
}

async function seedData(db) {
  const pwdSuper = bcrypt.hashSync('super2026', 10);

  // Une seule école par défaut
  db.run(`INSERT INTO ecoles (nom, slug, adresse, telephone, email, abonnement, lifetime) VALUES
    ('Madrasati','madrasati','Maroc','','contact@madrasati.ma','lifetime',1)
  `);

  // Un seul compte : Super Admin
  db.run(`INSERT INTO users (ecole_id, nom, prenom, email, password, role, telephone) VALUES
    (1,'Admin','Super','super@madrasati.ma','${pwdSuper}','super','0600000000')
  `);
}

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const results = [];
      stmt.bind(params);
      while (stmt.step()) { results.push(stmt.getAsObject()); }
      stmt.free();
      resolve(results);
    } catch (err) { reject(err); }
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      db.run(sql, params);
      saveDB();
      resolve({ lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0] });
    } catch (err) { reject(err); }
  });
}

function resetDB() { db = null; }

module.exports = { getDB, query, run, saveDB, resetDB };
