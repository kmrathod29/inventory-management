import { HardDrive } from "lucide-react";
import "./about.css";

const APP_NAME = "Dipali Traders - Inventory Manager";
const APP_VERSION = "1.0";
const DEVELOPER_NAME = "Midnight Sphere";
const DEVELOPER_URL = "https://midnight-profile.netlify.app/";

function DeveloperLink() {
  return (
    <a
      className="about-link"
      href={DEVELOPER_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      {DEVELOPER_NAME}
    </a>
  );
}

export function AboutSection() {
  return (
    <div className="settings-panel-content">
      <div className="settings-panel-header">
        <h2>About</h2>
        <p>Application version and support information.</p>
      </div>

      <div className="about-card">
        <div className="about-app-info">
          <h3>{APP_NAME}</h3>
          <p className="about-version">Version {APP_VERSION}</p>
        </div>

        <dl className="about-details">
          <div className="about-row">
            <dt className="about-label">Developer</dt>
            <dd className="about-value">
              <DeveloperLink />
            </dd>
          </div>
          <div className="about-row">
            <dt className="about-label">Built for</dt>
            <dd className="about-value">Dipali Traders</dd>
          </div>
          <div className="about-row">
            <dt className="about-label">Platform</dt>
            <dd className="about-value">Electron + React</dd>
          </div>
          <div className="about-row">
            <dt className="about-label">Database</dt>
            <dd className="about-value">SQLite (better-sqlite3)</dd>
          </div>
          <div className="about-row">
            <dt className="about-label">License</dt>
            <dd className="about-value">Proprietary</dd>
          </div>
        </dl>

        <div className="about-note">
          <HardDrive size={18} strokeWidth={1.75} aria-hidden="true" />
          <p>
            Your shop data is stored on this computer. Use Backup &amp; Restore
            to keep a safe copy.
          </p>
        </div>

        <div className="about-footer">
          <p>
            Built by <DeveloperLink /> for Dipali Traders
          </p>
        </div>
      </div>
    </div>
  );
}