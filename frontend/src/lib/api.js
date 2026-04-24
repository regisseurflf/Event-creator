import axios from "axios";

// En mode Electron : window.__BACKEND_URL__ injecté par main.js
// En mode Vite dev/build : variable d'env VITE_BACKEND_URL
const getBackendUrl = () => {
  if (typeof window !== "undefined" && window.__BACKEND_URL__) {
    return window.__BACKEND_URL__;
  }
  return import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8001";
};

export const API = `${getBackendUrl()}/api`;

export const api = axios.create({
  baseURL: API,
  timeout: 60000,
});

// Recalcule à chaque appel (port dynamique Electron)
export const getDynamicApi = () => `${getBackendUrl()}/api`;

export const fileUrl = (fileId) => `${getDynamicApi()}/files/${fileId}`;
export const roadmapUrl = (eventId) => `${getDynamicApi()}/events/${eventId}/roadmap.pdf`;

export const openRoadmap = async (eventId, pathOverride) => {
  let url = null;
  try {
    const dynamicApi = axios.create({ baseURL: getDynamicApi(), timeout: 60000 });
    const path = pathOverride || `/events/${eventId}/roadmap.pdf`;
    const resp = await dynamicApi.get(path, { responseType: "blob" });
    const blob = new Blob([resp.data], { type: "application/pdf" });
    url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `feuille_de_route_${eventId}.pdf`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    if (url) URL.revokeObjectURL(url);
    const { toast } = await import("sonner");
    toast.error("Impossible de générer la feuille de route");
  }
};
