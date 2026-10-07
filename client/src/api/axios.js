import axios from "axios";
import { API_BASE } from "./config";

const API = axios.create({
  baseURL: API_BASE,
});

API.interceptors.request.use((req) => {
  const userInfo = localStorage.getItem("userInfo");

  if (userInfo) {
    req.headers.Authorization = `Bearer ${JSON.parse(userInfo).token}`;
  }

  return req;
});

export default API;