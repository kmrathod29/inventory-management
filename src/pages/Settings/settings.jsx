import { useEffect, useRef, useState } from "react";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../hooks/ToastContext";
import { AppearanceSection } from "./Components/AppearanceSection";
import { DatabaseSection } from "./Components/DatabaseSection";
import { DefaultsSection } from "./Components/DefaultsSection";
import { ExportSection } from "./Components/ExportSection";
import { ProfilesSection } from "./Components/ProfilesSection";
import "./settings.css";

function fileName(filePath) {
  return filePath.split(/[\\/]/).pop();
}

const APPEARANCE_THEMES = [
  { value: "lara-light", label: "Lara" },
  { value: "lara-dark", label: "Lara dark" },
  { value: "claude-light", label: "Claude +" },
  { value: "claude-dark", label: "Claude dark" },
  { value: "zen-light", label: "Zen" },
  { value: "zen-dark", label: "Zen dark" },
  { value: "auto-blog-light", label: "Auto Blog" },
  { value: "auto-blog-dark", label: "Auto Blog dark" },
];

export function SettingsPage({
  appearanceTheme,
  appearanceMode,
  setAppearance,
}) {
  const [busy, setBusy] = useState("");
  const [settings, setSettings] = useState(null);
  const [profileId, setProfileId] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileDialogMode, setProfileDialogMode] = useState("");
  const [exportPath, setExportPath] = useState("");
  const [exportSelections, setExportSelections] = useState({
    products: true,
    customers: true,
    bills: true,
    imports: true,
    expenses: true,
  });
  const profileDialog = useRef(null);
  const showToast = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirm();

  useEffect(() => {
    const dialog = profileDialog.current;
    if (!dialog) return;
    if (profileDialogMode && !dialog.open) dialog.showModal();
    if (!profileDialogMode && dialog.open) dialog.close();
  }, [profileDialogMode]);

  useEffect(() => {
    let cancelled = false;
    window.db
      .getAppSettings()
      .then((currentSettings) => {
        if (cancelled) return;
        setSettings(currentSettings);
        setProfileId(currentSettings.activeProfileId);
        setProfileUsername(
          currentSettings.profiles.find(
            (profile) => profile.id === currentSettings.activeProfileId,
          )?.username || "user",
        );
      })
      .catch((error) => {
        showToast(
          error.message || "Could not load application settings.",
          "error",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  async function handleCreateBackup() {
    setBusy("backup");
    try {
      const result = await window.db.createBackup();
      if (result)
        showToast(`Backup saved as ${fileName(result.filePath)}.`, "success");
    } catch (error) {
      showToast(
        error.message || "Could not create the database backup.",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function handleRestoreBackup() {
    const accepted = await confirm(
      "Restore replaces the current database and restarts StockWise. A recovery backup will be created first. Continue?",
    );
    if (!accepted) return;
    setBusy("restore");
    try {
      const result = await window.db.restoreBackup();
      if (result) {
        showToast(
          `Restore complete. Recovery copy: ${fileName(result.recoveryBackupPath)}. Restarting...`,
          "success",
        );
      }
    } catch (error) {
      showToast(
        error.message || "Could not restore the database backup.",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function handleCreatePortableBackup() {
    setBusy("portable-backup");
    try {
      const result = await window.db.createPortableBackup();
      if (result)
        showToast(
          `Portable backup saved as ${fileName(result.filePath)}.`,
          "success",
        );
    } catch (error) {
      showToast(
        error.message || "Could not create the portable backup.",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function handleRestorePortableBackup() {
    const accepted = await confirm(
      "Restore replaces this profile's database and product images, then restarts StockWise. A recovery database backup will be created first. Continue?",
    );
    if (!accepted) return;
    setBusy("portable-restore");
    try {
      const result = await window.db.restorePortableBackup();
      if (result) {
        showToast(
          `Portable restore complete. Recovery copy: ${fileName(result.recoveryBackupPath)}. Restarting...`,
          "success",
        );
      }
    } catch (error) {
      showToast(
        error.message || "Could not restore the portable backup.",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function handlePaymentMethodChange(event) {
    setBusy("defaults");
    try {
      const updatedSettings = await window.db.updateDefaultPaymentMethod(
        event.target.value,
      );
      setSettings(updatedSettings);
      showToast("Default payment method updated.", "success");
    } catch (error) {
      showToast(
        error.message || "Could not update the default payment method.",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function handleAppearanceThemeChange(event) {
    const selected = event.target.value;
    const mode = selected.endsWith("-dark") ? "dark" : "light";
    const theme = selected.slice(0, -(mode.length + 1));
    setBusy("appearance");
    try {
      const updatedSettings = await window.db.updateAppearanceSettings(
        theme,
        mode,
      );
      setSettings(updatedSettings);
      setAppearance(updatedSettings);
      showToast("Appearance updated.", "success");
    } catch (error) {
      showToast(
        error.message || "Could not update the appearance theme.",
        "error",
      );
    } finally {
      setBusy("");
    }
  }

  async function handleOpenDataDirectory() {
    try {
      await window.db.openDataDirectory();
    } catch (error) {
      showToast(error.message || "Could not open the data folder.", "error");
    }
  }

  async function handleChangeDataDirectory() {
    const accepted = await confirm(
      "StockWise will copy the database and product images to an empty folder, then restart. The existing data will remain as a safety copy. Continue?",
    );
    if (!accepted) return;
    setBusy("path");
    try {
      const updatedSettings = await window.db.changeDataDirectory();
      if (updatedSettings) {
        setSettings(updatedSettings);
        showToast("Data copied. StockWise is restarting...", "success");
      }
    } catch (error) {
      showToast(error.message || "Could not change the data folder.", "error");
    } finally {
      setBusy("");
    }
  }

  async function handlePickExportDirectory() {
    try {
      const directory = await window.db.pickExportDirectory();
      if (directory) setExportPath(directory);
    } catch (error) {
      showToast(error.message || "Could not choose an export folder.", "error");
    }
  }

  async function handleExport() {
    if (!Object.values(exportSelections).some(Boolean)) {
      showToast("Choose at least one data section to export.", "error");
      return;
    }
    setBusy("export");
    try {
      const filePath = await window.db.exportData(exportPath, exportSelections);
      showToast(`Export created: ${fileName(filePath)}.`, "success");
    } catch (error) {
      showToast(error.message || "Could not create the export.", "error");
    } finally {
      setBusy("");
    }
  }

  function openProfileDialog() {
    setProfileUsername(
      profileId === "create-new"
        ? ""
        : profileId === "user"
          ? "user"
          : settings?.profiles.find((profile) => profile.id === profileId)
              ?.username || "",
    );
    setProfilePassword("");
    setProfileDialogMode(profileId === "create-new" ? "create" : "switch");
  }

  function handleProfileSelection(event) {
    const selectedId = event.target.value;
    setProfileId(selectedId);
    if (
      selectedId !== "create-new" &&
      selectedId !== settings?.activeProfileId
    ) {
      const selectedProfile = settings?.profiles.find(
        (profile) => profile.id === selectedId,
      );
      setProfileUsername(selectedProfile?.username || "");
      setProfilePassword("");
      setProfileDialogMode("switch");
    }
  }

  async function handleProfileDialogSubmit(event) {
    event.preventDefault();
    if (profileDialogMode === "create") {
      setBusy("profile-create");
    } else if (profileId === "user" && !settings?.defaultProfilePasswordSet) {
      setBusy("default-profile-password");
    } else {
      setBusy("profile-switch");
    }
    try {
      let targetProfileId = profileId;
      if (profileDialogMode === "create") {
        const createdSettings = await window.db.createProfile(
          profileUsername,
          profilePassword,
        );
        const newProfile = createdSettings.profiles.find(
          (profile) =>
            !profile.isDefault &&
            !settings?.profiles.some((existing) => existing.id === profile.id),
        );
        if (!newProfile)
          throw new Error(
            "The new profile was created, but could not be found.",
          );
        setSettings(createdSettings);
        targetProfileId = newProfile.id;
      } else if (profileId === "user" && !settings?.defaultProfilePasswordSet) {
        await window.db.setDefaultProfilePassword(profilePassword);
      }
      const updatedSettings = await window.db.switchProfile(
        targetProfileId,
        profileUsername,
        profilePassword,
      );
      setSettings(updatedSettings);
      setProfileId(targetProfileId);
      setProfileDialogMode("");
      showToast("Profile switched. Reloading StockWise...", "success");
    } catch (error) {
      showToast(
        error.message || "Could not complete the profile action.",
        "error",
      );
      setBusy("");
    }
  }

  return (
    <main className="settings-page">
      <header className="settings-header">
        <h1>Settings</h1>
      </header>
      <AppearanceSection
        appearanceTheme={appearanceTheme}
        appearanceMode={appearanceMode}
        settings={settings}
        busy={busy}
        themes={APPEARANCE_THEMES}
        onChange={handleAppearanceThemeChange}
      />
      <ProfilesSection
        settings={settings}
        busy={busy}
        profileId={profileId}
        profileUsername={profileUsername}
        setProfileUsername={setProfileUsername}
        profilePassword={profilePassword}
        setProfilePassword={setProfilePassword}
        profileDialogMode={profileDialogMode}
        profileDialog={profileDialog}
        onOpenDialog={openProfileDialog}
        onSelectProfile={handleProfileSelection}
        onSubmit={handleProfileDialogSubmit}
        onClose={() => setProfileDialogMode("")}
      />
      <DefaultsSection
        settings={settings}
        busy={busy}
        onChange={handlePaymentMethodChange}
      />
      <DatabaseSection
        settings={settings}
        busy={busy}
        onOpenDirectory={handleOpenDataDirectory}
        onChangeDirectory={handleChangeDataDirectory}
        onCreateBackup={handleCreateBackup}
        onRestoreBackup={handleRestoreBackup}
        onCreatePortableBackup={handleCreatePortableBackup}
        onRestorePortableBackup={handleRestorePortableBackup}
      />
      <ExportSection
        settings={settings}
        busy={busy}
        exportPath={exportPath}
        setExportPath={setExportPath}
        exportSelections={exportSelections}
        setExportSelections={setExportSelections}
        onPickDirectory={handlePickExportDirectory}
        onExport={handleExport}
      />
      {ConfirmDialogComponent}
    </main>
  );
}
