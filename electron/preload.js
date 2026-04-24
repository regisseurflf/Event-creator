// Preload script — expose l'URL du backend au renderer de façon sécurisée
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getBackendUrl: () => window.__BACKEND_URL__ || "http://127.0.0.1:8001",
});
