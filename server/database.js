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
  const pwd = bcrypt.hashSync('admin123', 10);
  const pwdProf = bcrypt.hashSync('prof123', 10);
  const pwdEleve = bcrypt.hashSync('eleve123', 10);
  const pwdSuper = bcrypt.hashSync('super2026', 10);

  db.run(`INSERT INTO ecoles (nom, slug, adresse, telephone, email, abonnement) VALUES
    ('École Principale Demo', 'principale', 'Casablanca, Maroc', '0522000001', 'admin@madrasati.ma', 'lifetime'),
    ('Collège Al Amal', 'alamal', 'Rabat, Maroc', '0537000001', 'alamal@madrasati.ma', 'trial'),
    ('École Avenir', 'avenir', 'Marrakech, Maroc', '0524000001', 'avenir@madrasati.ma', 'mensuel')
  `);

  db.run(`INSERT INTO users (ecole_id, nom, prenom, email, password, role, telephone) VALUES
    (1,'Super','Admin','super@madrasati.ma','${pwdSuper}','super','0600000001'),
    (1,'Administrateur','École','admin@madrasati.ma','${pwd}','admin','0522000001'),
    (1,'Benali','Mohammed','prof1@madrasati.ma','${pwdProf}','prof','0661000001'),
    (1,'Ouali','Fatima','prof2@madrasati.ma','${pwdProf}','prof','0661000002'),
    (1,'Alami','Youssef','prof3@madrasati.ma','${pwdProf}','prof','0661000003'),
    (1,'Tazi','Ahmed','eleve1@madrasati.ma','${pwdEleve}','eleve','0621000001'),
    (1,'Chraibi','Sara','eleve2@madrasati.ma','${pwdEleve}','eleve','0621000002'),
    (1,'Idrissi','Omar','eleve3@madrasati.ma','${pwdEleve}','eleve','0621000003'),
    (1,'Tazi','Hassan','parent1@madrasati.ma','${pwdEleve}','parent','0621000010'),
    (1,'Demo','Visiteur','demo@madrasati.ma','${pwdEleve}','admin','0600000000'),
    (1,'Chraibi','Nadia','parent2@madrasati.ma','${pwdEleve}','parent','0621000011'),
    (2,'Bennani','Karim','admin2@madrasati.ma','${pwd}','admin','0537000002'),
    (3,'Filali','Aicha','admin3@madrasati.ma','${pwd}','admin','0524000002')
  `);

  db.run(`INSERT INTO niveaux (ecole_id, nom, ordre) VALUES
    (1,'1ère Année Collège',1),(1,'2ème Année Collège',2),(1,'3ème Année Collège',3),
    (1,'Tronc Commun',4),(1,'1ère Bac',5),(1,'2ème Bac',6)
  `);

  db.run(`INSERT INTO classes (ecole_id, nom, niveau_id, prof_principal_id, annee_scolaire) VALUES
    (1,'1AC-A',1,2,'2024-2025'),(1,'1AC-B',1,3,'2024-2025'),
    (1,'2AC-A',2,4,'2024-2025'),(1,'TC-A',4,2,'2024-2025')
  `);

  db.run(`INSERT INTO profs (user_id, specialite, cin, date_embauche) VALUES
    (2,'Mathématiques','BE123456','2020-09-01'),
    (3,'Français','BE789012','2019-09-01'),
    (4,'Sciences','BK345678','2021-09-01')
  `);

  db.run(`INSERT INTO eleves (user_id, classe_id, numero_matricule, parent_id, date_inscription) VALUES
    (5,1,'MAT-2024-001',8,'2024-09-01'),
    (6,1,'MAT-2024-002',9,'2024-09-01'),
    (7,2,'MAT-2024-003',8,'2024-09-01')
  `);

  db.run(`INSERT INTO matieres (ecole_id, nom, coefficient, couleur) VALUES
    (1,'Mathématiques',7,'#3B82F6'),(1,'Français',4,'#10B981'),
    (1,'Arabe',4,'#F59E0B'),(1,'Sciences',3,'#8B5CF6'),
    (1,'Histoire-Géo',3,'#EF4444'),(1,'Éducation Physique',2,'#06B6D4'),
    (1,'Anglais',3,'#EC4899')
  `);

  db.run(`INSERT INTO prof_matieres (prof_id, matiere_id, classe_id) VALUES
    (1,1,1),(1,1,2),(2,2,1),(2,2,2),(3,4,1),(3,4,2)
  `);

  db.run(`INSERT INTO emploi_du_temps (ecole_id, classe_id, matiere_id, prof_id, jour, heure_debut, heure_fin, salle) VALUES
    (1,1,1,1,'Lundi','08:00','10:00','Salle 1'),
    (1,1,2,2,'Lundi','10:00','12:00','Salle 1'),
    (1,1,4,3,'Mardi','08:00','10:00','Salle 2'),
    (1,1,3,1,'Mardi','10:00','12:00','Salle 1'),
    (1,1,1,1,'Mercredi','08:00','10:00','Salle 1'),
    (1,1,5,2,'Jeudi','08:00','10:00','Salle 3'),
    (1,1,7,3,'Vendredi','08:00','10:00','Salle 2'),
    (1,2,1,1,'Lundi','08:00','10:00','Salle 3'),
    (1,2,2,2,'Lundi','10:00','12:00','Salle 3'),
    (1,2,4,3,'Mardi','08:00','10:00','Salle 4'),
    (1,2,3,1,'Mercredi','08:00','10:00','Salle 3'),
    (1,2,5,2,'Jeudi','10:00','12:00','Salle 2'),
    (1,3,1,1,'Lundi','14:00','16:00','Salle 5'),
    (1,3,2,2,'Mardi','14:00','16:00','Salle 5'),
    (1,4,1,1,'Mercredi','14:00','16:00','Salle 6')
  `);

  db.run(`INSERT INTO periodes (ecole_id, nom, annee_scolaire, date_debut, date_fin) VALUES
    (1,'1er Trimestre','2024-2025','2024-09-01','2024-12-20'),
    (1,'2ème Trimestre','2024-2025','2025-01-06','2025-03-28'),
    (1,'3ème Trimestre','2024-2025','2025-04-07','2025-06-30')
  `);

  db.run(`INSERT INTO notes (eleve_id, matiere_id, periode_id, type_note, valeur, sur) VALUES
    (1,1,1,'devoir',15.5,20),(1,1,1,'examen',17,20),
    (1,2,1,'devoir',14,20),(1,2,1,'examen',13.5,20),
    (1,3,1,'devoir',16,20),(1,4,1,'examen',18,20),
    (2,1,1,'devoir',12,20),(2,1,1,'examen',13,20),
    (2,2,1,'devoir',15,20),(2,3,1,'examen',14,20),
    (3,1,1,'devoir',18,20),(3,1,1,'examen',19,20)
  `);

  db.run(`INSERT INTO presences (eleve_id, date, statut, matiere_id) VALUES
    (1,'2025-01-06','present',1),(1,'2025-01-07','present',2),
    (1,'2025-01-08','absent',1),(1,'2025-01-09','present',3),
    (2,'2025-01-06','present',1),(2,'2025-01-07','retard',2),
    (2,'2025-01-08','present',1),(3,'2025-01-06','present',1)
  `);

  db.run(`INSERT INTO annonces (ecole_id, titre, contenu, auteur_id, destinataires) VALUES
    (1,'Rentrée scolaire 2024-2025','Bienvenue à tous les élèves et parents. La rentrée scolaire est fixée au 1er septembre 2024.',1,'tous'),
    (1,'Réunion parents d''élèves','Une réunion des parents d''élèves est prévue le samedi 15 novembre à 10h00.',1,'parents'),
    (1,'Examens de mi-trimestre','Les examens de mi-trimestre auront lieu du 25 au 28 novembre.',1,'eleves')
  `);

  db.run(`INSERT INTO factures (eleve_id, numero, description, montant, montant_paye, statut, date_emission, date_echeance) VALUES
    (1,'FAC-2024-0001','Frais de scolarité - 1er Trimestre 2024-2025',3500,3500,'payee','2024-09-01','2024-09-30'),
    (1,'FAC-2024-0002','Frais de scolarité - 2ème Trimestre 2024-2025',3500,0,'impayee','2025-01-01','2025-01-31'),
    (2,'FAC-2024-0003','Frais de scolarité - 1er Trimestre 2024-2025',3500,2000,'partielle','2024-09-01','2024-09-30'),
    (2,'FAC-2024-0004','Frais de transport - 1er Semestre',1200,1200,'payee','2024-09-01','2024-09-15'),
    (3,'FAC-2024-0005','Frais de scolarité - 1er Trimestre 2024-2025',3500,0,'impayee','2024-09-01','2024-09-30')
  `);

  db.run(`INSERT INTO paiements (facture_id, montant, date_paiement, mode, reference) VALUES
    (1,3500,'2024-09-05','virement','VIR-2024-001'),
    (3,2000,'2024-09-10','especes','REC-2024-003'),
    (4,1200,'2024-09-02','cheque','CHQ-100234')
  `);

  db.run(`INSERT INTO messages (ecole_id, expediteur_id, destinataire_id, sujet, contenu) VALUES
    (1,2,8,'Réunion parents - Rappel','Bonjour, je vous rappelle la réunion des parents prévue ce samedi à 10h00. Merci de confirmer votre présence.'),
    (1,3,8,'Notes de votre enfant Ahmed','Bonjour M. Tazi, votre fils Ahmed a obtenu de très bons résultats ce trimestre. Félicitations !'),
    (1,8,2,'Question sur les horaires','Bonjour, pourriez-vous me confirmer les horaires de l''établissement pour le mois prochain ? Merci.')
  `);

  db.run(`INSERT INTO notifications (ecole_id, user_id, type, titre, message) VALUES
    (1,2,'facture','Facture impayée','La facture FAC-2024-0002 est en retard de paiement.'),
    (1,2,'absence','Absence signalée','L''élève Ahmed Tazi était absent le 08/01/2025 en Mathématiques.'),
    (1,5,'note','Nouvelle note','Vous avez une nouvelle note en Mathématiques : 17/20'),
    (1,8,'message','Nouveau message','Vous avez reçu un message de M. Benali.')
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
