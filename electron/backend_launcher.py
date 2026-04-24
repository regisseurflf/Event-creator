"""
Point d'entrée PyInstaller pour le backend FastAPI.
Lit le port depuis l'argument --port (passé par Electron).
"""
import sys
import os
import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    args, _ = parser.parse_known_args()

    import uvicorn
    # Le dossier du bundle PyInstaller est sys._MEIPASS
    if hasattr(sys, "_MEIPASS"):
        os.chdir(sys._MEIPASS)

    uvicorn.run(
        "server:app",
        host=args.host,
        port=args.port,
        log_level="warning",
    )

if __name__ == "__main__":
    main()
