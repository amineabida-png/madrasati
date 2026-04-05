# مدرستي · MADRASATI — ERP Scolaire Maroc

## LANCEMENT EN 3 COMMANDES

  npm install
  node server/index.js
  # Ouvrir http://localhost:3000

## COMPTES DE TEST

  Admin   : admin@madrasati.ma  / admin123
  Prof    : prof1@madrasati.ma  / prof123
  Eleve   : eleve1@madrasati.ma / eleve123
  Parent  : parent1@madrasati.ma / eleve123

## MODULES

  - Authentification (JWT, 4 roles)
  - Dashboard intelligent par role
  - Gestion Eleves (CRUD complet + profil)
  - Gestion Enseignants
  - Classes et Groupes
  - Emploi du temps (grille visuelle)
  - Presences (saisie rapide + stats)
  - Notes et Bulletins (PDF export)
  - Facturation (paiements + PDF pro)
  - Annonces et communication

## ETAPES APRES LIVRAISON

  1. PERSONNALISATION (30 min)
     - Changer le nom ecole dans index.html
     - Mettre a jour infos dans facturation.js (pour les PDFs)
     - Changer mot de passe admin

  2. SAISIE DES DONNEES (1-2h)
     - Creer niveaux et classes reels
     - Ajouter enseignants
     - Inscrire les eleves
     - Saisir emploi du temps

  3. DEPLOIEMENT (optionnel)
     - VPS Ubuntu + Node.js + PM2 + Nginx
     - pm2 start server/index.js --name madrasati
     - Sauvegarder data/madrasati.db (seul fichier important)

## SAUVEGARDE

  cp data/madrasati.db backup_$(date +%Y%m%d).db
  (Ce seul fichier contient toute la base de donnees)
