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

function tryParseJson(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* continue */
    }
  }

  const startObj = trimmed.indexOf("{");
  const endObj = trimmed.lastIndexOf("}");
  if (startObj !== -1 && endObj > startObj) {
    try {
      return JSON.parse(trimmed.slice(startObj, endObj + 1));
    } catch {
      /* continue */
    }
  }

  const startArr = trimmed.indexOf("[");
  const endArr = trimmed.lastIndexOf("]");
  if (startArr !== -1 && endArr > startArr) {
    try {
      return JSON.parse(trimmed.slice(startArr, endArr + 1));
    } catch {
      /* continue */
    }
  }

  return null;
}

function looksLikePriceResult(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  return (
    obj.classification != null ||
    obj.price_range_text != null ||
    obj.min_price != null ||
    obj.max_price != null ||
    obj.match_status != null ||
    obj.details != null
  );
}

function findPriceResult(node, depth = 0) {
  if (node == null || depth > 8) return null;

  if (typeof node === "string") {
    const parsed = tryParseJson(node);
    return parsed ? findPriceResult(parsed, depth + 1) : null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findPriceResult(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof node === "object") {
    if (looksLikePriceResult(node)) return node;

    // Prefer common n8n wrappers first
    for (const key of ["json", "data", "body", "output", "text", "message", "content", "result"]) {
      if (node[key] != null) {
        const found = findPriceResult(node[key], depth + 1);
        if (found) return found;
      }
    }

    for (const value of Object.values(node)) {
      const found = findPriceResult(value, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function normalizePriceResult(payload) {
  const priceRangeText =
    payload.price_range_text ||
    (payload.min_price != null && payload.max_price != null
      ? `₹${payload.min_price} - ₹${payload.max_price}`
      : null);

  const classification =
    payload.classification ||
    payload.item ||
    payload.product ||
    payload.name ||
    null;

  const details =
    payload.details ||
    payload.reasoning ||
    payload.output ||
    payload.analysis ||
    payload.description ||
    null;

  return {
    classification: classification || "AI Classification Result",
    min_price: payload.min_price ?? null,
    max_price: payload.max_price ?? null,
    price_range_text: priceRangeText || "Evaluated in INR",
    currency: payload.currency || "INR",
    match_status: payload.match_status || null,
    details: details || "No analysis text returned.",
    // aliases for older clients
    item: classification || "AI Classification Result",
    suggestedRange: priceRangeText || "Evaluated in INR",
    reasoning: details || "No analysis text returned.",
    raw: payload,
  };
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

    const found = findPriceResult(n8nResponse.data);
    if (!found) {
      console.error(
        "Price analyser: could not map n8n payload:",
        JSON.stringify(n8nResponse.data)?.slice(0, 2000),
      );
      return res.status(502).json({
        message:
          "Price workflow returned data, but classification/price fields were missing. Check the Respond to Webhook node output.",
        n8nData: n8nResponse.data,
      });
    }

    return res.json(normalizePriceResult(found));
  } catch (error) {
    console.error("Price analyser proxy error:", error.message);
    return res.status(500).json({
      message: error.message || "Price analysis failed.",
    });
  }
});

export default router;
