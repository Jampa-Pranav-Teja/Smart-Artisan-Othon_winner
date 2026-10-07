import express from "express";
import { getReports, getInsights } from "../controllers/reportController.js";

const router = express.Router();

router.get("/insights", getInsights);
router.get("/", getReports);

export default router;
