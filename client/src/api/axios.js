import axios from "axios";
import { API_BASE } from "./config";

const API = axios.create({
  baseURL: API_BASE,
});

API.interceptors.request.use((req) => {
  try {
    const raw = localStorage.getItem("userInfo");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token) {
        req.headers.Authorization = `Bearer ${parsed.token}`;
      }
    }
  } catch {
    /* ignore bad session JSON */
  }

  return req;
});

export default API;