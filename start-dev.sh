#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "→ Arrêt de l'app..."
  kill $BACKEND_PID $FRONTEND_PID $ELECTRON_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

echo ""
echo "╔══════════════════════════════════════╗"
echo "║        L'Ampli — Démarrage           ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Backend ──────────────────────────────────────────────────────────────────
echo "→ Démarrage du backend (port 8001)..."
cd "$ROOT/backend"
source "$ROOT/backend/venv/bin/activate"
python3 -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload &
BACKEND_PID=$!
deactivate

# Attendre que le backend réponde
echo "→ Attente du backend..."
for i in $(seq 1 20); do
  if curl -s http://127.0.0.1:8001/api/ > /dev/null 2>&1; then
    echo "✓ Backend prêt"
    break
  fi
  sleep 1
done

# ── Frontend ──────────────────────────────────────────────────────────────────
echo "→ Démarrage du frontend (port 3000)..."
cd "$ROOT/frontend"
REACT_APP_BACKEND_URL=http://127.0.0.1:8001 "$ROOT/frontend/node_modules/.bin/craco" start &
FRONTEND_PID=$!

# Attendre que le frontend réponde
echo "→ Attente du frontend..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✓ Frontend prêt"
    break
  fi
  sleep 2
done

# ── Electron ──────────────────────────────────────────────────────────────────
echo "→ Démarrage d'Electron..."
cd "$ROOT"
"$ROOT/node_modules/.bin/electron" . &
ELECTRON_PID=$!

echo ""
echo "✓ L'Ampli est lancé !"
echo "  Appuie sur Ctrl+C pour tout arrêter."
echo ""

wait $ELECTRON_PID
cleanup
