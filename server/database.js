const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Sur Railway, utiliser /data si disponible (volume persistant), sinon fallback local
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
  } else {
    db = new SQL.Database();
    await initSchema(db);
    await seedData(db);
    saveDB();
  }

  return db;
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
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','prof','eleve','parent')),
      telephone TEXT,
      adresse TEXT,
      date_naissance TEXT,
      photo TEXT,
      actif INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS niveaux (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      ordre INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  `);
}

async function seedData(db) {
  const pwd = bcrypt.hashSync('admin123', 10);
  const pwdProf = bcrypt.hashSync('prof123', 10);
  const pwdEleve = bcrypt.hashSync('eleve123', 10);
  const pwdSuper = bcrypt.hashSync('super2026', 10);

  // Users — id 1 = super admin
  db.run(`INSERT INTO users (nom, prenom, email, password, role, telephone) VALUES
    ('Super','Admin','super@madrasati.ma','${pwdSuper}','super','0600000001'),
    ('Administrateur','École','admin@madrasati.ma','${pwd}','admin','0522000001'),
    ('Benali','Mohammed','prof1@madrasati.ma','${pwdProf}','prof','0661000001'),
    ('Ouali','Fatima','prof2@madrasati.ma','${pwdProf}','prof','0661000002'),
    ('Alami','Youssef','prof3@madrasati.ma','${pwdProf}','prof','0661000003'),
    ('Tazi','Ahmed','eleve1@madrasati.ma','${pwdEleve}','eleve','0621000001'),
    ('Chraibi','Sara','eleve2@madrasati.ma','${pwdEleve}','eleve','0621000002'),
    ('Idrissi','Omar','eleve3@madrasati.ma','${pwdEleve}','eleve','0621000003'),
    ('Tazi','Hassan','parent1@madrasati.ma','${pwdEleve}','parent','0621000010'),
    ('Demo','Visiteur','demo@madrasati.ma','${pwdEleve}','admin','0600000000'),
    ('Chraibi','Nadia','parent2@madrasati.ma','${pwdEleve}','parent','0621000011')
  `);

  // Niveaux
  db.run(`INSERT INTO niveaux (nom, ordre) VALUES
    ('1ère Année Collège', 1),
    ('2ème Année Collège', 2),
    ('3ème Année Collège', 3),
    ('Tronc Commun', 4),
    ('1ère Bac', 5),
    ('2ème Bac', 6)
  `);

  // Classes
  db.run(`INSERT INTO classes (nom, niveau_id, prof_principal_id, annee_scolaire) VALUES
    ('1AC-A', 1, 2, '2024-2025'),
    ('1AC-B', 1, 3, '2024-2025'),
    ('2AC-A', 2, 4, '2024-2025'),
    ('TC-A', 4, 2, '2024-2025')
  `);

  // Profs
  db.run(`INSERT INTO profs (user_id, specialite, cin, date_embauche) VALUES
    (2, 'Mathématiques', 'BE123456', '2020-09-01'),
    (3, 'Français', 'BE789012', '2019-09-01'),
    (4, 'Sciences', 'BK345678', '2021-09-01')
  `);

  // Elèves
  db.run(`INSERT INTO eleves (user_id, classe_id, numero_matricule, parent_id, date_inscription) VALUES
    (5, 1, 'MAT-2024-001', 8, '2024-09-01'),
    (6, 1, 'MAT-2024-002', 9, '2024-09-01'),
    (7, 2, 'MAT-2024-003', 8, '2024-09-01')
  `);

  // Matières
  db.run(`INSERT INTO matieres (nom, coefficient, couleur) VALUES
    ('Mathématiques', 7, '#3B82F6'),
    ('Français', 4, '#10B981'),
    ('Arabe', 4, '#F59E0B'),
    ('Sciences', 3, '#8B5CF6'),
    ('Histoire-Géo', 3, '#EF4444'),
    ('Éducation Physique', 2, '#06B6D4'),
    ('Anglais', 3, '#EC4899')
  `);

  // Prof-Matières
  db.run(`INSERT INTO prof_matieres (prof_id, matiere_id, classe_id) VALUES
    (1, 1, 1),(1, 1, 2),(2, 2, 1),(2, 2, 2),(3, 4, 1),(3, 4, 2)
  `);

  // Emploi du temps
  db.run(`INSERT INTO emploi_du_temps (classe_id, matiere_id, prof_id, jour, heure_debut, heure_fin, salle) VALUES
    (1, 1, 1, 'Lundi', '08:00', '10:00', 'Salle 1'),
    (1, 2, 2, 'Lundi', '10:00', '12:00', 'Salle 1'),
    (1, 4, 3, 'Mardi', '08:00', '10:00', 'Salle 2'),
    (1, 3, 1, 'Mardi', '10:00', '12:00', 'Salle 1'),
    (1, 1, 1, 'Mercredi', '08:00', '10:00', 'Salle 1'),
    (1, 5, 2, 'Jeudi', '08:00', '10:00', 'Salle 3'),
    (1, 7, 3, 'Vendredi', '08:00', '10:00', 'Salle 2')
  `);

  // Périodes
  db.run(`INSERT INTO periodes (nom, annee_scolaire, date_debut, date_fin) VALUES
    ('1er Trimestre', '2024-2025', '2024-09-01', '2024-12-20'),
    ('2ème Trimestre', '2024-2025', '2025-01-06', '2025-03-28'),
    ('3ème Trimestre', '2024-2025', '2025-04-07', '2025-06-30')
  `);

  // Notes
  db.run(`INSERT INTO notes (eleve_id, matiere_id, periode_id, type_note, valeur, sur) VALUES
    (1, 1, 1, 'devoir', 15.5, 20),(1, 1, 1, 'examen', 17, 20),
    (1, 2, 1, 'devoir', 14, 20),(1, 2, 1, 'examen', 13.5, 20),
    (1, 3, 1, 'devoir', 16, 20),(1, 4, 1, 'examen', 18, 20),
    (2, 1, 1, 'devoir', 12, 20),(2, 1, 1, 'examen', 13, 20),
    (2, 2, 1, 'devoir', 15, 20),(2, 3, 1, 'examen', 14, 20),
    (3, 1, 1, 'devoir', 18, 20),(3, 1, 1, 'examen', 19, 20)
  `);

  // Présences
  db.run(`INSERT INTO presences (eleve_id, date, statut, matiere_id) VALUES
    (1, '2025-01-06', 'present', 1),(1, '2025-01-07', 'present', 2),
    (1, '2025-01-08', 'absent', 1),(1, '2025-01-09', 'present', 3),
    (2, '2025-01-06', 'present', 1),(2, '2025-01-07', 'retard', 2),
    (2, '2025-01-08', 'present', 1),(3, '2025-01-06', 'present', 1)
  `);

  // Annonces
  db.run(`INSERT INTO annonces (titre, contenu, auteur_id, destinataires) VALUES
    ('Rentrée scolaire 2024-2025', 'Bienvenue à tous les élèves et parents. La rentrée scolaire est fixée au 1er septembre 2024. Veuillez vous assurer que vos dossiers sont complets.', 1, 'tous'),
    ('Réunion parents d''élèves', 'Une réunion des parents d''élèves est prévue le samedi 15 novembre à 10h00. Votre présence est fortement souhaitée.', 1, 'parents'),
    ('Examens de mi-trimestre', 'Les examens de mi-trimestre auront lieu du 25 au 28 novembre. Les élèves sont priés de se préparer.', 1, 'eleves')
  `);

  // Factures
  db.run(`INSERT INTO factures (eleve_id, numero, description, montant, montant_paye, statut, date_emission, date_echeance) VALUES
    (1, 'FAC-2024-0001', 'Frais de scolarité - 1er Trimestre 2024-2025', 3500, 3500, 'payee', '2024-09-01', '2024-09-30'),
    (1, 'FAC-2024-0002', 'Frais de scolarité - 2ème Trimestre 2024-2025', 3500, 0, 'impayee', '2025-01-01', '2025-01-31'),
    (2, 'FAC-2024-0003', 'Frais de scolarité - 1er Trimestre 2024-2025', 3500, 2000, 'partielle', '2024-09-01', '2024-09-30'),
    (2, 'FAC-2024-0004', 'Frais de transport - 1er Semestre', 1200, 1200, 'payee', '2024-09-01', '2024-09-15'),
    (3, 'FAC-2024-0005', 'Frais de scolarité - 1er Trimestre 2024-2025', 3500, 0, 'impayee', '2024-09-01', '2024-09-30')
  `);

  // Paiements
  db.run(`INSERT INTO paiements (facture_id, montant, date_paiement, mode, reference) VALUES
    (1, 3500, '2024-09-05', 'virement', 'VIR-2024-001'),
    (3, 2000, '2024-09-10', 'especes', 'REÇ-2024-003'),
    (4, 1200, '2024-09-02', 'cheque', 'CHQ-100234')
  `);
}

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const results = [];
      stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      resolve(results);
    } catch (err) {
      reject(err);
    }
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      db.run(sql, params);
      saveDB();
      resolve({ lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0] });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { getDB, query, run, saveDB };
