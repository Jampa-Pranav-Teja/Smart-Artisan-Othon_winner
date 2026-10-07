import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { MainLayout } from "./layouts/MainLayout";

// Organization Pages (Desktop Focused)
import { HomePage } from "./pages/HomePage";
import { ProductionPage } from "./pages/ProductionPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AIAssistantPage } from "./pages/AIAssistantPage";
import { SettingsPage } from "./pages/SettingsPage"; 
import { SecurityPage } from "./pages/SecurityPage";

// Artisan Pages (Mobile Optimized)
import { ArtisanDashboard } from "./pages/ArtisanDashboard";
import { MoneyFlow } from "./pages/MoneyFlow";
import { ArtisanSettings } from "./pages/ArtisanSettings";
import { PriceAnalyser } from "./pages/PriceAnalyser";
import { InventoryPage } from "./pages/InventoryPage";
import { QualityCheck } from "./pages/QualityCheck";
import { AnalyticsPage } from "./pages/AnalyticsPage"; 

function readUserInfo() {
  try {
    const raw = localStorage.getItem("userInfo");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    localStorage.removeItem("userInfo");
    return null;
  }
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!readUserInfo());
  const userInfo = readUserInfo();
  // Default to artisan workspace when role is missing (older sessions)
  const role = userInfo?.role || (isLoggedIn ? "artisan" : null);

  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route 
          path="/login" 
          element={<LoginPage setIsLoggedIn={setIsLoggedIn} />} 
        />
        <Route path="/register" element={<RegisterPage />} />

        {isLoggedIn ? (
          <>
            {/* 1. ORGANIZATION FLOW (Desktop Sidebar Layout) */}
            {role === "organization" && (
              <Route element={<MainLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/production" element={<ProductionPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/ai-assistant" element={<AIAssistantPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/security" element={<SecurityPage />} />
              </Route>
            )}

            {/* 2. ARTISAN FLOW (Mobile Full-Screen Layout) */}
            {role === "artisan" && (
              <>
                <Route path="/" element={<ArtisanDashboard />} />
                <Route path="/money-flow" element={<MoneyFlow />} />
                <Route path="/settings" element={<ArtisanSettings />} />
                <Route path="/price-analyser" element={<PriceAnalyser />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/quality-check" element={<QualityCheck />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
              </>
            )}

            {/* FALLBACK FOR LOGGED IN USERS */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          /* REDIRECT TO LOGIN IF NOT LOGGED IN */
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;