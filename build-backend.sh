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
  --collect-all fastapi \
  --collect-all uvicorn \
  --collect-all starlette \
  --collect-all motor \
  --collect-all pymongo \
  --collect-all pydantic \
  --collect-all pydantic_core \
  --collect-all certifi \
  --collect-all reportlab \
  --collect-all httpx \
  --collect-all httpcore \
  --collect-all anyio \
  --collect-all dotenv \
  --collect-all multipart \
  --hidden-import uvicorn.logging \
  --hidden-import uvicorn.loops \
  --hidden-import uvicorn.loops.auto \
  --hidden-import uvicorn.loops.uvloop \
  --hidden-import uvicorn.protocols \
  --hidden-import uvicorn.protocols.http \
  --hidden-import uvicorn.protocols.http.auto \
  --hidden-import uvicorn.protocols.http.h11_impl \
  --hidden-import uvicorn.protocols.http.httptools_impl \
  --hidden-import uvicorn.protocols.websockets \
  --hidden-import uvicorn.protocols.websockets.auto \
  --hidden-import uvicorn.lifespan \
  --hidden-import uvicorn.lifespan.on \
  --hidden-import email.mime.text \
  --hidden-import email.mime.multipart \
  "$ROOT/electron/backend_launcher.py"

deactivate
echo "✓ Backend buildé : dist/backend/lampli-server"
