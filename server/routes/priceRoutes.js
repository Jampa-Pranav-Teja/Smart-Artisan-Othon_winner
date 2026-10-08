import express from "express";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const DEFAULT_N8N_PRICE_URL =
  "https://n8n.srv1710717.hstgr.cloud/webhook/4907eca7-65ca-41d2-a128-f345821b73ac";

function unwrapPayload(responseData) {
  let candidate = responseData;

  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return { output: candidate };
    }
  }

  if (Array.isArray(candidate)) {
    candidate = candidate[0];
  }

  if (candidate && typeof candidate === "object") {
    if (candidate.json && typeof candidate.json === "object") {
      candidate = candidate.json;
    } else if (candidate.data && typeof candidate.data === "object") {
      candidate = Array.isArray(candidate.data) ? candidate.data[0] : candidate.data;
    }
  }

  if (typeof candidate === "string") {
    try {
      const parsed = JSON.parse(candidate);
      return parsed;
    } catch {
      return { output: candidate };
    }
  }

  if (candidate && typeof candidate === "object") {
    // Keep structured fields; map free-text AI replies into output
    if (!candidate.output && typeof candidate.text === "string") {
      return { ...candidate, output: candidate.text };
    }
    return candidate;
  }

  return { output: String(candidate ?? "") };
}

router.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded." });
    }

    const webhookUrl = process.env.N8N_PRICE_WEBHOOK_URL || DEFAULT_N8N_PRICE_URL;

    const n8nForm = new FormData();
    n8nForm.append("image", req.file.buffer, {
      filename: req.file.originalname || "artisan-product.jpg",
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

    const payload = unwrapPayload(n8nResponse.data);

    // n8n schema:
    // classification, min_price, max_price, price_range_text, currency, match_status, details
    const priceRangeText =
      payload.price_range_text ||
      (payload.min_price != null && payload.max_price != null
        ? `₹${payload.min_price} - ₹${payload.max_price}`
        : null);

    return res.json({
      classification:
        payload.classification ||
        payload.item ||
        payload.product ||
        payload.name ||
        "AI Classification Result",
      min_price: payload.min_price ?? null,
      max_price: payload.max_price ?? null,
      price_range_text: priceRangeText || "Evaluated in INR",
      currency: payload.currency || "INR",
      match_status: payload.match_status || null,
      details:
        payload.details ||
        payload.reasoning ||
        payload.output ||
        payload.analysis ||
        payload.description ||
        "No analysis text returned.",
      raw: payload,
    });
  } catch (error) {
    console.error("Price analyser proxy error:", error.message);
    return res.status(500).json({
      message: error.message || "Price analysis failed.",
    });
  }
});

export default router;
