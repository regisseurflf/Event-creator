#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     L'Ampli — Installation Mac       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Homebrew ──────────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  echo "→ Installation de Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Ajouter Homebrew au PATH (Apple Silicon)
  if [[ $(uname -m) == "arm64" ]]; then
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
else
  echo "✓ Homebrew déjà installé"
fi

# ── 2. Python & Node ─────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "→ Installation de Python..."
  brew install python
else
  echo "✓ Python déjà installé"
fi

if ! command -v node &>/dev/null; then
  echo "→ Installation de Node.js..."
  brew install node
else
  echo "✓ Node.js déjà installé"
fi

# ── 3. Dépendances backend ───────────────────────────────────────────────────
echo "→ Installation des dépendances Python..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt
deactivate
cd ..

# ── 4. Fichier .env backend ──────────────────────────────────────────────────
if [ ! -f backend/.env ]; then
  echo "→ Création du fichier de configuration..."
  cat > backend/.env << 'ENVEOF'
MONGO_URL=mongodb+srv://ampli:TiVsvVliVP9nn659@cluster0.v55rbrn.mongodb.net/?appName=Cluster0
DB_NAME=lampli
CORS_ORIGINS=http://localhost:3000
EMERGENT_LLM_KEY=
ENVEOF
  echo "✓ backend/.env créé"
else
  echo "✓ backend/.env existe déjà"
fi

# ── 5. Dépendances frontend ──────────────────────────────────────────────────
echo "→ Installation des dépendances frontend..."
cd frontend
npm install --silent
cd ..

# ── 6. Dépendances Electron ──────────────────────────────────────────────────
echo "→ Installation d'Electron..."
npm install --silent

echo ""
echo "╔══════════════════════════════════════╗"
echo "║         Installation terminée !      ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Pour lancer l'app en mode développement :"
echo ""
echo "  Terminal 1 → cd frontend && npm start"
echo "  Terminal 2 → source backend/venv/bin/activate && uvicorn server:app --reload --port 8001"
echo "  Terminal 3 → npm run electron:dev"
echo ""
echo "Pour créer le .dmg distribuable :"
echo "  npm run dist"
echo ""
