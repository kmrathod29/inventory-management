// Pages:
import { DashboardPage } from "./pages/Dashboard/dashboard";
import { InventoryPage } from "./pages/Inventory/inventory";
import { ReportsPage } from "./pages/Reports/reports";
import { SettingsPage } from "./pages/Settings/settings";
import { SideBar } from "./components/sidebar";
import { TitleBar } from "./components/TitleBar/TitleBar";
import { HashRouter, Navigate, Route, Routes } from "react-router";
import "./App.css";
import "./index.css";

import { useState, useEffect } from "react";
import { Billing } from "./pages/Billing/billing";
import { CustomersPage } from "./pages/Customers/customers";
import { useToast } from "./hooks/ToastContext";

function App() {
  const [appearanceTheme, setAppearanceTheme] = useState("lara");
  const [appearanceMode, setAppearanceMode] = useState("dark");
  const showToast = useToast();

  useEffect(() => {
    let cancelled = false;
    window.db.getAppSettings()
      .then((settings) => {
        if (!cancelled) {
          setAppearanceTheme(settings.appearanceTheme);
          setAppearanceMode(settings.appearanceMode);
        }
      })
      .catch((error) => {
        showToast(error?.message || "Could not load appearance settings.", "error");
      });
    return () => { cancelled = true; };
  }, [showToast]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", appearanceTheme);
    root.setAttribute("data-mode", appearanceMode);

    const bodyStyle = getComputedStyle(document.body);
    const bgColor = bodyStyle.backgroundColor;
    const textColor = bodyStyle.color;
    window.db?.setTitleBarOverlay?.(bgColor, textColor);
  }, [appearanceTheme, appearanceMode]);

  function setAppearance(settings) {
    setAppearanceTheme(settings.appearanceTheme);
    setAppearanceMode(settings.appearanceMode);
  }

  return (
    <HashRouter>
      <div className="main-container" spellCheck={true}>
        <TitleBar />
        <SideBar isDark={appearanceMode === "dark"} />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/finances" element={<Navigate to="/reports" replace />} />
            <Route path="/analytics" element={<Navigate to="/reports" replace />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  appearanceTheme={appearanceTheme}
                  appearanceMode={appearanceMode}
                  setAppearance={setAppearance}
                />
              }
            />
            <Route path="/billing/*" element={<Billing />} />
          </Routes>
        </div>
      </div>
    </HashRouter>
  );
}

export default App;
