import mongoose from "mongoose";
import Payment from "../models/Payment.js";

const OrderSchema = new mongoose.Schema({
  artisanId: { type: String, required: true },
  name: { type: String, required: true },
  contact: { type: String },
  product: { type: String, required: true },
  pending: { type: Number, default: 0 },
  delivered: { type: String, enum: ["Yes", "No"], default: "No" },
  createdAt: { type: Date, default: Date.now },
});

const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);

function getPeriodStart(timeframe) {
  const now = new Date();
  if (timeframe === "weekly") {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return start;
  }
  if (timeframe === "yearly") {
    const start = new Date(now);
    start.setFullYear(now.getFullYear() - 1);
    return start;
  }
  // monthly (default)
  const start = new Date(now);
  start.setMonth(now.getMonth() - 1);
  return start;
}

function getPreviousPeriodRange(timeframe) {
  const currentStart = getPeriodStart(timeframe);
  const now = new Date();
  const durationMs = now.getTime() - currentStart.getTime();
  return {
    start: new Date(currentStart.getTime() - durationMs),
    end: currentStart,
  };
}

/** Artisan Analytics page — GET /api/reports/insights */
export const getInsights = async (req, res) => {
  try {
    const { artisanId, timeframe = "monthly" } = req.query;

    if (!artisanId) {
      return res.status(400).json({ message: "Missing artisanId query parameter" });
    }

    const periodStart = getPeriodStart(timeframe);
    const prev = getPreviousPeriodRange(timeframe);

    const [currentOrders, previousOrders] = await Promise.all([
      Order.find({ artisanId, createdAt: { $gte: periodStart } }),
      Order.find({
        artisanId,
        createdAt: { $gte: prev.start, $lt: prev.end },
      }),
    ]);

    const sumPending = (orders) =>
      orders.reduce((acc, o) => acc + (Number(o.pending) || 0), 0);

    const revenue = sumPending(currentOrders);
    const previousRevenue = sumPending(previousOrders);
    const soldCount = currentOrders.filter((o) => o.delivered === "Yes").length;

    let growth = "+0%";
    if (previousRevenue > 0) {
      const pct = Math.round(((revenue - previousRevenue) / previousRevenue) * 100);
      growth = `${pct >= 0 ? "+" : ""}${pct}%`;
    } else if (revenue > 0) {
      growth = "+100%";
    }

    const TARGET = timeframe === "yearly" ? 120000 : timeframe === "weekly" ? 5000 : 20000;
    const progress = Math.min(100, Math.round((revenue / TARGET) * 100));

    const productMap = {};
    currentOrders.forEach((o) => {
      const key = o.product || "Unknown";
      productMap[key] = (productMap[key] || 0) + 1;
    });

    const topProducts = Object.entries(productMap)
      .map(([name, sales]) => ({ name, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    res.json({
      revenue,
      soldCount,
      growth,
      progress,
      topProducts,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getReports = async (req, res) => {
  try {
    const payments = await Payment.find();

    const totalEarnings = payments.reduce(
      (acc, item) => acc + (item.amount || 0),
      0,
    );

    const totalProduction = payments.length;
    const totalExpenses = Math.round(totalEarnings * 0.35);
    const netProfit = totalEarnings - totalExpenses;

    const weekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthLabels = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const weekMap = {};
    const monthMap = {};
    const yearMap = {};

    payments.forEach((p) => {
      const d = new Date(p.paymentDate); // ✅ FIXED

      const day = weekLabels[d.getDay()];
      weekMap[day] = (weekMap[day] || 0) + (p.amount || 0); // ✅ FIXED

      const month = monthLabels[d.getMonth()];
      monthMap[month] = (monthMap[month] || 0) + (p.amount || 0); // ✅ FIXED

      const year = d.getFullYear();
      yearMap[year] = (yearMap[year] || 0) + (p.amount || 0);
    });

    const weeklyData = weekLabels.map((l) => ({
      label: l,
      value: weekMap[l] || 0,
    }));

    const monthlyData = monthLabels.map((l) => ({
      label: l,
      value: monthMap[l] || 0,
    }));

    const yearlyData = Object.keys(yearMap).map((y) => ({
      label: y,
      value: yearMap[y],
    }));

    const productMap = {};

    payments.forEach((p) => {
      productMap[p.product] = (productMap[p.product] || 0) + (p.amount || 0);
    });

    const topProducts = Object.entries(productMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const max = Math.max(...topProducts.map((p) => p.value), 1);

    const topProductsWithProgress = topProducts.map((p) => ({
      name: p.name,
      value: `₹${p.value}`,
      progress: Math.round((p.value / max) * 100),
    }));

    res.json({
      totalEarnings,
      totalProduction,
      totalExpenses,
      netProfit,
      weeklyData,
      monthlyData,
      yearlyData,
      topProducts: topProductsWithProgress,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
