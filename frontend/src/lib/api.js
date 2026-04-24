import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  timeout: 30000,
});

export const fileUrl = (fileId) => `${API}/files/${fileId}`;
export const roadmapUrl = (eventId) => `${API}/events/${eventId}/roadmap.pdf`;
