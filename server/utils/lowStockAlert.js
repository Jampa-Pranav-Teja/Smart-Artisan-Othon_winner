import axios from "axios";
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

/**
 * Fire n8n refill alert when stock crosses below 20% of maxStock.
 * Non-blocking for the API response — failures are logged only.
 */
export async function maybeSendLowStockAlert({ previousItem, updatedItem }) {
  try {
    if (!updatedItem) return;

    const wasLow = previousItem ? isLowStock(previousItem) : false;
    const nowLow = isLowStock(updatedItem);

    // Only alert when newly crossing under 20% (avoid spam on every -1)
    if (!nowLow || wasLow) return;

    const percent = Math.round(getStockPercent(updatedItem) * 100);
    const webhookUrl =
      process.env.N8N_LOW_STOCK_WEBHOOK_URL || DEFAULT_LOW_STOCK_WEBHOOK;

    let telegramBotToken = "";
    if (updatedItem.artisanId) {
      try {
        const user = await User.findById(updatedItem.artisanId)
          .select("telegramBotToken name email")
          .lean();
        telegramBotToken = user?.telegramBotToken || "";
      } catch {
        /* artisanId may not always be a valid ObjectId in older data */
      }
    }

    const kind =
      updatedItem.itemType === "material" ? "material" : "product/goods";

    const payload = {
      alert_type: "low_stock",
      message: `Refill needed: ${updatedItem.name} (${kind}) is at ${percent}% stock (${updatedItem.stock}/${updatedItem.maxStock} ${updatedItem.unit}). Please refill.`,
      artisanId: updatedItem.artisanId,
      telegramBotToken,
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

    await axios.post(webhookUrl, payload, {
      timeout: 15000,
      headers: { "Content-Type": "application/json" },
      validateStatus: () => true,
    });
  } catch (error) {
    console.error("Low stock alert webhook failed:", error.message);
  }
}
