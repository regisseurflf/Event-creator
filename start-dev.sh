#!/bin/bash
# Lance les 3 services en parallèle dans un seul terminal

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "→ Arrêt de l'app..."
  kill $BACKEND_PID $FRONTEND_PID $ELECTRON_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

# Backend
echo "→ Démarrage du backend..."
cd "$ROOT/backend"
source venv/bin/activate
uvicorn server:app --host 127.0.0.1 --port 8001 --reload &
BACKEND_PID=$!
deactivate

# Attendre que le backend soit prêt
sleep 3

# Frontend
echo "→ Démarrage du frontend..."
cd "$ROOT/frontend"
REACT_APP_BACKEND_URL=http://127.0.0.1:8001 npm start &
FRONTEND_PID=$!

# Attendre que le frontend soit prêt
sleep 8

# Electron
echo "→ Démarrage d'Electron..."
cd "$ROOT"
npm run electron:dev &
ELECTRON_PID=$!

echo ""
echo "✓ L'Ampli est lancé !"
echo "  Appuie sur Ctrl+C pour tout arrêter."
echo ""

wait $ELECTRON_PID
cleanup
