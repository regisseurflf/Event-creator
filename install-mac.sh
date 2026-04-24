#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     L'Ampli — Installation Mac       ║"
echo "╚══════════════════════════════════════╝"
echo ""

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── 1. Homebrew ──────────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  echo "→ Installation de Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
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
  echo "✓ Python déjà installé : $(python3 --version)"
fi

if ! command -v node &>/dev/null; then
  echo "→ Installation de Node.js..."
  brew install node
else
  echo "✓ Node.js déjà installé : $(node --version)"
fi

# ── 3. Dépendances backend ───────────────────────────────────────────────────
echo "→ Installation des dépendances Python..."
cd "$ROOT/backend"
python3 -m venv venv
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
deactivate
cd "$ROOT"
echo "✓ Backend prêt"

# ── 4. Fichier .env backend ──────────────────────────────────────────────────
if [ ! -f "$ROOT/backend/.env" ]; then
  echo "→ Création du fichier de configuration..."
  cat > "$ROOT/backend/.env" << 'ENVEOF'
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
cd "$ROOT/frontend"
npm install --legacy-peer-deps
cd "$ROOT"
echo "✓ Frontend prêt"

# ── 6. Dépendances Electron (racine) ─────────────────────────────────────────
echo "→ Installation d'Electron..."
cd "$ROOT"
npm install
echo "✓ Electron prêt"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║      Installation terminée !         ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Lancer l'app :"
echo "  bash start-dev.sh"
echo ""
