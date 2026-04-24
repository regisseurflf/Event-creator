import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  timeout: 60000,
});

export const fileUrl = (fileId) => `${API}/files/${fileId}`;
export const roadmapUrl = (eventId) => `${API}/events/${eventId}/roadmap.pdf`;

/**
 * Fetch the roadmap PDF as a Blob and open it in a new tab via a blob URL.
 * This avoids the "blank page" issue some browsers/headless envs have when
 * navigating directly to an inline PDF response.
 */
export const openRoadmap = async (eventId, pathOverride) => {
  let url = null;
  try {
    const path = pathOverride || `/events/${eventId}/roadmap.pdf`;
    const resp = await api.get(path, { responseType: "blob" });
    const blob = new Blob([resp.data], { type: "application/pdf" });
    url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) {
      // Pop-up blocked — force download via anchor
      const a = document.createElement("a");
      a.href = url;
      a.download = `feuille_de_route_${eventId}.pdf`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    if (url) URL.revokeObjectURL(url);
    // Dynamic import to avoid circular dep at module level
    const { toast } = await import("sonner");
    toast.error("Impossible de générer la feuille de route");
  }
};
