import express from "express";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const DEFAULT_N8N_QC_URL =
  "https://n8n.srv1710717.hstgr.cloud/webhook/48fd30e2-86e0-4bc8-b483-a0f961d2d144";

function extractJsonObject(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // AI nodes sometimes wrap JSON in markdown fences
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        /* continue */
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function normalizeQcPayload(responseData) {
  let candidate = responseData;

  if (typeof candidate === "string") {
    candidate = extractJsonObject(candidate) || candidate;
  }

  if (Array.isArray(candidate)) {
    candidate = candidate[0];
  }

  if (candidate && typeof candidate === "object") {
    // Common n8n wrappers
    candidate =
      candidate.json ||
      candidate.data ||
      candidate.output ||
      candidate.text ||
      candidate;
  }

  if (typeof candidate === "string") {
    candidate = extractJsonObject(candidate);
  }

  if (Array.isArray(candidate)) {
    candidate = candidate[0];
  }

  if (!candidate || typeof candidate !== "object") {
    const err = new Error("Empty or unexpected n8n quality response.");
    err.statusCode = 502;
    throw err;
  }

  const score = Number(candidate.quality_score);
  const observations = Array.isArray(candidate.observations)
    ? candidate.observations.map(String).filter(Boolean)
    : [];
  const improvementTips = Array.isArray(candidate.improvement_tips)
    ? candidate.improvement_tips.map(String).filter(Boolean)
    : [];

  if (
    !Number.isFinite(score) &&
    !candidate.quality_label &&
    !observations.length &&
    !improvementTips.length
  ) {
    const err = new Error("Could not find quality fields in n8n response.");
    err.statusCode = 502;
    throw err;
  }

  return {
    quality_score: Number.isFinite(score) ? score : 5,
    quality_label: candidate.quality_label || "Quality Assessed",
    observations,
    improvement_tips: improvementTips,
  };
}

router.post("/check", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded." });
    }

    const webhookUrl = process.env.N8N_QC_WEBHOOK_URL || DEFAULT_N8N_QC_URL;

    const n8nForm = new FormData();
    n8nForm.append("image", req.file.buffer, {
      filename: req.file.originalname || "artisan-product-qc.jpg",
      contentType: req.file.mimetype || "image/jpeg",
    });

    const n8nResponse = await axios.post(webhookUrl, n8nForm, {
      headers: n8nForm.getHeaders(),
      timeout: 120000,
      maxBodyLength: Infinity,
      validateStatus: () => true,
    });

    if (n8nResponse.status >= 400) {
      const hint =
        n8nResponse.data?.hint ||
        n8nResponse.data?.message ||
        `n8n webhook returned HTTP ${n8nResponse.status}`;
      return res.status(502).json({
        message: hint,
        n8nStatus: n8nResponse.status,
        n8nData: n8nResponse.data,
      });
    }

    const normalized = normalizeQcPayload(n8nResponse.data);
    return res.json(normalized);
  } catch (error) {
    console.error("Quality check proxy error:", error.message);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Quality check failed.",
    });
  }
});

export default router;
