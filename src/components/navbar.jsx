import "./Styles/navbar.css";
import { EditConsole } from "../pages/Inventory/Components/EditConsole";
import { useEffect, useRef, useState } from "react";
import { useToast } from "../hooks/ToastContext";
import { useDataChanged } from "../hooks/useDataChanged";

export function NavBar({
  isInventoryPage,
  fetchProducts,
  search,
  setSearch,
  onStartBillAdd,
  editMode = false,
  onToggleEditMode,
}) {
  const addItemToInventory = useRef();
  const addModeDialog = useRef();
  const [isImporting, setIsImporting] = useState(false);
  const [preferredAddMode, setPreferredAddMode] = useState(undefined);
  const [rememberAddMode, setRememberAddMode] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    let cancelled = false;
    window.db.getAppSettings()
      .then((settings) => {
        if (!cancelled) setPreferredAddMode(settings.inventoryAddItemMode ?? null);
      })
      .catch((error) => {
        showToast(error?.message || "Could not load your add-item preference.", "error");
        if (!cancelled) setPreferredAddMode(null);
      });
    return () => { cancelled = true; };
  }, [showToast]);

  useDataChanged(async () => {
    const settings = await window.db.getAppSettings();
    setPreferredAddMode(settings.inventoryAddItemMode ?? null);
  });

  function toggleAddItemDialog() {
    if (!addItemToInventory.current) {
      return;
    }
    addItemToInventory.current.hasAttribute("open")
      ? addItemToInventory.current.close()
      : addItemToInventory.current.showModal();
  }

  async function selectAddMode(mode) {
    addModeDialog.current?.close();
    if (rememberAddMode) {
      try {
        const settings = await window.db.updateInventoryAddItemMode(mode);
        setPreferredAddMode(settings.inventoryAddItemMode);
      } catch (error) {
        showToast(error?.message || "Could not remember your add-item choice.", "error");
      }
    }

    if (mode === "bill") {
      onStartBillAdd?.();
    } else {
      toggleAddItemDialog();
    }
  }

  function openAddItem() {
    if (preferredAddMode === "bill") {
      onStartBillAdd?.();
      return;
    }
    if (preferredAddMode === "default") {
      toggleAddItemDialog();
      return;
    }
    setRememberAddMode(false);
    addModeDialog.current?.showModal();
  }

  async function handleImportExcel() {
    if (isImporting) return;
    setIsImporting(true);
    try {
      const filePath = await window.db.pickExcelFile();
      if (!filePath) return;
      const result = await window.db.importExcel(filePath);
      showToast(
        `Imported ${result.imported} products. Skipped ${result.skipped} (no usable price data).`,
        "success",
      );
      await fetchProducts();
    } catch (error) {
      showToast(error?.message || "Could not import this Excel file.", "error");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="header">
      <div className="searchbar">
        <div className="search-wrapper">
          <i className="ti ti-search search-icon"></i>
          <input
            placeholder="Search a product"
            type="text"
            className="search-input"
            value={search ?? ""}
            onChange={(e) => setSearch?.(e.target.value)}
          />
        </div>

      </div>
      {isInventoryPage ? (
        <>
          <button
            className="nav-add-item-btn"
            onClick={openAddItem}
            disabled={preferredAddMode === undefined}
          >
            Add Item
          </button>
          <button className="nav-add-item-btn" onClick={handleImportExcel} disabled={isImporting}>
            {isImporting ? "Importing..." : "Import"}
          </button>
          <button
            className={`nav-add-item-btn inventory-edit-toggle${editMode ? " active" : ""}`}
            type="button"
            aria-pressed={editMode}
            onClick={onToggleEditMode}
          >
            {editMode ? "Done editing" : "Edit"}
          </button>
        </>
      ) : (
        ""
      )}
      <EditConsole ref={addItemToInventory} />
      <dialog ref={addModeDialog} className="inventory-add-mode-dialog">
        <form method="dialog" className="inventory-add-mode-content">
          <button className="inventory-add-mode-close" aria-label="Close" value="cancel">
            ×
          </button>
          <h2>How would you like to add this item?</h2>
          <p>Choose the standard inventory form or enter the item through a bill invoice.</p>
          <div className="inventory-add-mode-actions">
            <button type="button" onClick={() => selectAddMode("default")}>
              Default add
            </button>
            <button type="button" onClick={() => selectAddMode("bill")}>
              Add via bill
            </button>
          </div>
          <label className="inventory-add-mode-remember">
            <input
              type="checkbox"
              checked={rememberAddMode}
              onChange={(event) => setRememberAddMode(event.target.checked)}
            />
            Remember my choice
          </label>
        </form>
      </dialog>
    </div>
  );
}
