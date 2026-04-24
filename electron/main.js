const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");

let mainWindow = null;
let backendProcess = null;

// ── Trouver un port libre ────────────────────────────────────────────────────
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

// ── Attendre que le backend réponde ─────────────────────────────────────────
function waitForBackend(port, retries = 40, delay = 500) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const sock = new net.Socket();
      sock.setTimeout(400);
      sock
        .on("connect", () => { sock.destroy(); resolve(); })
        .on("error", () => {
          sock.destroy();
          if (retries-- > 0) setTimeout(attempt, delay);
          else reject(new Error("Backend did not start in time"));
        })
        .on("timeout", () => {
          sock.destroy();
          if (retries-- > 0) setTimeout(attempt, delay);
          else reject(new Error("Backend timeout"));
        })
        .connect(port, "127.0.0.1");
    };
    attempt();
  });
}

// ── Lancer le backend PyInstaller ────────────────────────────────────────────
async function startBackend(port) {
  const isDev = !app.isPackaged;

  let backendPath;
  if (isDev) {
    // En dev : lancer uvicorn directement
    backendPath = null;
  } else {
    // En prod : exécutable PyInstaller dans Resources/
    backendPath = path.join(process.resourcesPath, "backend", "lampli-server");
  }

  const mongoUrl = "mongodb+srv://ampli:TiVsvVliVP9nn659@cluster0.v55rbrn.mongodb.net/?appName=Cluster0";

  const env = {
    ...process.env,
    MONGO_URL: mongoUrl,
    DB_NAME: "lampli",
    PORT: String(port),
    CORS_ORIGINS: `http://localhost:${port}`,
    EMERGENT_LLM_KEY: process.env.EMERGENT_LLM_KEY || "",
  };

  if (isDev) {
    const venvPython = path.join(__dirname, "..", "backend", "venv", "bin", "python3");
    const serverPath = path.join(__dirname, "..", "backend", "server.py");
    backendProcess = spawn(venvPython, [
      "-m", "uvicorn", "server:app",
      "--host", "127.0.0.1",
      "--port", String(port),
    ], { cwd: path.join(__dirname, "..", "backend"), env, stdio: "pipe" });
  } else {
    backendProcess = spawn(backendPath, ["--host", "127.0.0.1", "--port", String(port)], {
      env,
      stdio: "pipe",
    });
  }

  backendProcess.stdout?.on("data", (d) => console.log("[backend]", d.toString().trim()));
  backendProcess.stderr?.on("data", (d) => console.error("[backend]", d.toString().trim()));
  backendProcess.on("exit", (code) => console.log(`[backend] exited with code ${code}`));
}

// ── Créer la fenêtre principale ──────────────────────────────────────────────
function createWindow(backendPort) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0A0A0C",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "assets", "icon.png"),
    title: "L'Ampli",
  });

  // Injecter l'URL du backend dans la page
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.executeJavaScript(
      `window.__BACKEND_URL__ = "http://127.0.0.1:${backendPort}";`
    );
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL(`http://localhost:3000`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
  }

  // Ouvrir les liens externes dans le navigateur système
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── Cycle de vie de l'app ────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    const port = await getFreePort();
    await startBackend(port);
    await waitForBackend(port);
    createWindow(port);
  } catch (err) {
    console.error("Startup error:", err);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (backendProcess) {
    backendProcess.kill("SIGTERM");
    backendProcess = null;
  }
});
