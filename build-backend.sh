#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "→ Build du backend (PyInstaller)..."
cd "$ROOT/backend"
source venv/bin/activate
pip install -q pyinstaller

pyinstaller \
  --onefile \
  --name lampli-server \
  --distpath "$ROOT/dist/backend" \
  --workpath "$ROOT/build/pyinstaller" \
  --specpath "$ROOT/build/pyinstaller" \
  --add-data "$ROOT/backend/server.py:." \
  --hidden-import uvicorn.logging \
  --hidden-import uvicorn.loops \
  --hidden-import uvicorn.loops.auto \
  --hidden-import uvicorn.protocols \
  --hidden-import uvicorn.protocols.http \
  --hidden-import uvicorn.protocols.http.auto \
  --hidden-import uvicorn.protocols.websockets \
  --hidden-import uvicorn.protocols.websockets.auto \
  --hidden-import uvicorn.lifespan \
  --hidden-import uvicorn.lifespan.on \
  --hidden-import motor.motor_asyncio \
  --hidden-import pymongo \
  --hidden-import certifi \
  --hidden-import reportlab \
  --hidden-import httpx \
  --hidden-import dotenv \
  "$ROOT/electron/backend_launcher.py"

deactivate
echo "✓ Backend buildé : dist/backend/lampli-server"
