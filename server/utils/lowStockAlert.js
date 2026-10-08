import axios from "axios";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const DEFAULT_LOW_STOCK_WEBHOOK =
  "https://n8n.srv1710717.hstgr.cloud/webhook-test/f631dfff-17ac-4cf5-82a4-b05ff21b1aad";

const LOW_STOCK_THRESHOLD = 0.2; // 20%

export function getStockPercent(item) {
  const maxStock = Number(item?.maxStock) || 0;
  const stock = Number(item?.stock) || 0;
  if (maxStock <= 0) return 0;
  return stock / maxStock;
}

export function isLowStock(item) {
  return getStockPercent(item) < LOW_STOCK_THRESHOLD;
}

async function resolveTelegramUser({ artisanId, authHeader }) {
  // 1) Prefer logged-in user from Bearer token (fixes anonymous_artisan inventory rows)
  if (authHeader?.startsWith("Bearer ") && process.env.JWT_SECRET) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.id) {
        const user = await User.findById(decoded.id)
          .select("telegramBotToken telegramChatId name email")
          .lean();
        if (user) return user;
      }
    } catch {
      /* ignore invalid JWT */
    }
  }

  // 2) Fall back to inventory artisanId when it is a real Mongo ObjectId
  if (artisanId && mongoose.Types.ObjectId.isValid(artisanId)) {
    try {
      return await User.findById(artisanId)
        .select("telegramBotToken telegramChatId name email")
        .lean();
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Fire n8n refill alert when stock crosses below 20% of maxStock.
 * Non-blocking for the API response — failures are logged only.
 */
export async function maybeSendLowStockAlert({
  previousItem,
  updatedItem,
  authHeader,
}) {
  try {
    if (!updatedItem) return;

    const wasLow = previousItem ? isLowStock(previousItem) : false;
    const nowLow = isLowStock(updatedItem);

    // Only alert when newly crossing under 20% (avoid spam on every -1)
    if (!nowLow || wasLow) return;

    const percent = Math.round(getStockPercent(updatedItem) * 100);
    const webhookUrl =
      process.env.N8N_LOW_STOCK_WEBHOOK_URL || DEFAULT_LOW_STOCK_WEBHOOK;

    const user = await resolveTelegramUser({
      artisanId: updatedItem.artisanId,
      authHeader,
    });

    const telegramBotToken = user?.telegramBotToken || "";
    const telegramChatId = user?.telegramChatId || "";

    const kind =
      updatedItem.itemType === "material" ? "material" : "product/goods";

    const payload = {
      alert_type: "low_stock",
      message: `Refill needed: ${updatedItem.name} (${kind}) is at ${percent}% stock (${updatedItem.stock}/${updatedItem.maxStock} ${updatedItem.unit}). Please refill.`,
      artisanId: user?._id
        ? String(user._id)
        : updatedItem.artisanId,
      artisanName: user?.name || "",
      artisanEmail: user?.email || "",
      telegramBotToken,
      telegramChatId,
      item: {
        id: String(updatedItem._id),
        name: updatedItem.name,
        itemType: updatedItem.itemType,
        stock: updatedItem.stock,
        maxStock: updatedItem.maxStock,
        unit: updatedItem.unit,
        percent,
        thresholdPercent: 20,
      },
      triggeredAt: new Date().toISOString(),
    };

    if (!telegramBotToken || !telegramChatId) {
      console.warn(
        "Low stock alert: missing Telegram credentials for artisan",
        payload.artisanId,
      );
    }

    await axios.post(webhookUrl, payload, {
      timeout: 15000,
      headers: { "Content-Type": "application/json" },
      validateStatus: () => true,
    });
  } catch (error) {
    console.error("Low stock alert webhook failed:", error.message);
  }
}
