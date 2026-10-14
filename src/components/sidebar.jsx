import "./Styles/sidebar.css";
import { useState } from "react";
import { Link, useLocation } from "react-router";

const navLinks = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "ti-layout-dashboard",
    path: "/",
  },
  { id: "inventory", label: "Inventory", icon: "ti-box", path: "/inventory" },
  { id: "billing", label: "Billing", icon: "ti-box", path: "/billing" },
  { id: "finances", label: "Finances", icon: "ti-receipt", path: "/finances" },
  {
    id: "analytics",
    label: "Analytics",
    icon: "ti-chart-bar",
    path: "/analytics",
  },
];

export function SideBar({ isDark }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="sidebar-wrap">
      <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="logo-area">
          <div className="logo-icon">
            <img src={isDark ? "logo-white.png" : "logo-dark.png"} alt="StockWise logo" />
          </div>
          <span className="logo-name">StockWise</span>
        </div>

        <div className="nav-links">
          {navLinks.map((link) => (
            <Link
              key={link.id}
              to={link.path}
              className={`nav-link ${location.pathname === link.path ? "active" : ""}`}
            >
              <i className={`ti ${link.icon}`}></i>
              <span className="link-label">{link.label}</span>
              <span className="tooltip">{link.label}</span>
            </Link>
          ))}
        </div>

        <div className="settings-area">
          <Link
            to="/settings"
            className={`nav-link ${location.pathname === "/settings" ? "active" : ""}`}
          >
            <i className="ti ti-settings"></i>
            <span className="link-label">Settings</span>
            <span className="tooltip">Settings</span>
          </Link>
        </div>

        <button
          className="toggle-btn"
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed(!collapsed)}
        >
          <i className="ti ti-chevron-left"></i>
        </button>
      </div>
    </div>
  );
}
