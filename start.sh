#!/bin/bash
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          مدرستي  ·  MADRASATI                        ║"
echo "║          Système de Gestion Scolaire                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js non trouvé. Installez Node.js 18+ depuis https://nodejs.org"
  exit 1
fi

echo "✓ Node.js $(node -v) détecté"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installation des dépendances..."
  npm install
fi

echo "🚀 Démarrage de Madrasati..."
echo ""
echo "┌─────────────────────────────────────┐"
echo "│  Accès : http://localhost:3000       │"
echo "│                                     │"
echo "│  Comptes de test :                  │"
echo "│  admin@madrasati.ma / admin123      │"
echo "│  prof1@madrasati.ma  / prof123      │"
echo "│  eleve1@madrasati.ma / eleve123     │"
echo "└─────────────────────────────────────┘"
echo ""

node server/index.js
