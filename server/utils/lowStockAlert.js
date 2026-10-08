import axios from "axios";

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
 * `user` must be the logged-in artisan document (includes Telegram fields).
 */
export async function maybeSendLowStockAlert({
  previousItem,
  updatedItem,
  user,
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

    const telegramBotToken = user?.telegramBotToken || "";
    const telegramChatId = user?.telegramChatId || "";
    const artisanId = user?._id
      ? String(user._id)
      : updatedItem.artisanId;

    const kind =
      updatedItem.itemType === "material" ? "material" : "product/goods";

    const payload = {
      alert_type: "low_stock",
      message: `Refill needed: ${updatedItem.name} (${kind}) is at ${percent}% stock (${updatedItem.stock}/${updatedItem.maxStock} ${updatedItem.unit}). Please refill.`,
      artisanId,
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
        artisanId,
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
