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
  echo "✓ Homebrew : $(brew --version | head -1)"
fi

# ── 2. Python & Node ─────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  brew install python
else
  echo "✓ Python : $(python3 --version)"
fi

if ! command -v node &>/dev/null; then
  brew install node
else
  echo "✓ Node.js : $(node --version)"
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

# ── 4. Fichier .env ──────────────────────────────────────────────────────────
if [ ! -f "$ROOT/backend/.env" ]; then
  cat > "$ROOT/backend/.env" << 'ENVEOF'
MONGO_URL=mongodb+srv://ampli:TiVsvVliVP9nn659@cluster0.v55rbrn.mongodb.net/?appName=Cluster0
DB_NAME=lampli
CORS_ORIGINS=http://127.0.0.1:3000
EMERGENT_LLM_KEY=
ENVEOF
  echo "✓ backend/.env créé"
else
  echo "✓ backend/.env existe déjà"
fi

# ── 5. Dépendances frontend ───────────────────────────────────────────────────
echo "→ Installation des dépendances frontend (Vite)..."
cd "$ROOT/frontend"
npm install
cd "$ROOT"
echo "✓ Frontend prêt"

# ── 6. Electron ──────────────────────────────────────────────────────────────
echo "→ Installation d'Electron..."
cd "$ROOT"
npm install
echo "✓ Electron prêt"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║      Installation terminée !         ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Pour lancer l'app :"
echo "  bash start-dev.sh"
echo ""
