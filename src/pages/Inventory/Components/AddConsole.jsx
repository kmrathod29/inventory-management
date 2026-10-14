import { useState, useRef } from "react";
import { useResolvedImage } from "../../../hooks/resolvedImage.js";
import { useToast } from "../../../hooks/ToastContext.jsx";
import { BUCKET_SIZES } from "../../../utils/constants.js";
import { useErrorHandler } from "../../../hooks/useErrorHandler";

export function AddConsole() {
    const showToast = useToast();
    const { handleAsync } = useErrorHandler();
  const [name, setName] = useState("");
  const [baseInput, setBaseInput] = useState("");
  const [basesList, setBasesList] = useState([]);
  const [image, setImage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const resolvedImage = useResolvedImage(image);

  // Keyboard shortcut support
  const baseInputRef = useRef(null);

  const [rows, setRows] = useState(
    BUCKET_SIZES.reduce((acc, size) => {
      acc[size] = { landing: "", mp: "", sales: "", stock: "" };
      return acc;
    }, {}),
  );

  function updateRow(size, field, value) {
    setRows((prev) => ({
      ...prev,
      [size]: { ...prev[size], [field]: value },
    }));
  }

  function handleAddBase() {
    const trimmed = baseInput.trim();
    if (!trimmed) return;
    if (basesList.includes(trimmed)) {
      showToast("This base is already in the list.");
      return;
    }
    setBasesList((prev) => [...prev, trimmed]);
    setBaseInput("");
  }

  function handleRemoveBase(base) {
    setBasesList((prev) => prev.filter((b) => b !== base));
  }

  async function handlePickImage() {
    const filePath = await handleAsync(
      () => window.db.pickImage(),
      "Failed to pick image"
    );
    if (!filePath) return;
    const relativePath = await handleAsync(
      () => window.db.copyImage(filePath),
      "Failed to copy image"
    );
    if (relativePath) {
      setImage(relativePath);
    }
  }

  async function handleAdd() {
    if (isSaving) return;

    const filledRows = BUCKET_SIZES.filter((size) => {
      const r = rows[size];
      return r.landing !== "" && r.mp !== "" && r.sales !== "";
    });

    if (!name || basesList.length === 0 || filledRows.length === 0) {
      showToast(
        "Please enter a product name, add at least one base, and fill in at least one size row.",
      );
      return;
    }

    setIsSaving(true);
    const success = await handleAsync(
      () => window.db.saveInventoryProduct({
        name,
        images: image,
        variants: filledRows.map((size) => ({
          bucket_size: size,
          landing: parseFloat(rows[size].landing),
          sales: parseFloat(rows[size].sales),
          mp: parseFloat(rows[size].mp),
        })),
        bases: basesList.map((baseName) => ({
          name: baseName,
          stocks: filledRows.map((size) => parseFloat(rows[size].stock || 0)),
        })),
      }),
      "Failed to add product and stock",
    );
    setIsSaving(false);

    if (!success) return;

    showToast("Added successfully!");
    setBasesList([]);
    setRows(
      BUCKET_SIZES.reduce((acc, size) => {
        acc[size] = { landing: "", mp: "", sales: "", stock: "" };
        return acc;
      }, {}),
    );
  }

  return (
    <div className="edit-console-body">
      <div className="left-side">
        <h4 style={{ fontWeight: 500, margin: "0 0 4px" }}>Add an Item</h4>
        <div
          className="product-image-placeholder"
          onClick={handlePickImage}
          style={{ cursor: "pointer" }}
        >
          <img
            src={resolvedImage}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: 8,
            }}
          />
        </div>
      </div>

      <div className="right-side">
        <input
          type="text"
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="base-input-row">
          <input
            ref={baseInputRef}
            type="text"
            placeholder="Base (e.g. AC1)"
            value={baseInput}
            onChange={(e) => setBaseInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || (e.shiftKey && e.key === "Enter")) {
                e.preventDefault();
                handleAddBase();
              }
            }}
          />
          <button
            type="button"
            className="btn-add-base"
            onClick={handleAddBase}
          >
            Add base
          </button>
        </div>

        {basesList.length > 0 && (
          <div className="base-chip-list">
            {basesList.map((b) => (
              <span key={b} className="base-chip">
                {b}
                <button type="button" onClick={() => handleRemoveBase(b)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="field-divider"></div>

        <table className="variant-input-table">
          <thead>
            <tr>
              <th>Size</th>
              <th>Landing</th>
              <th>MP</th>
              <th>Sales</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {BUCKET_SIZES.map((size) => (
              <tr key={size}>
                <td>{size}</td>
                <td>
                  <input
                    type="number"
                    value={rows[size].landing}
                    onChange={(e) => updateRow(size, "landing", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={rows[size].mp}
                    onChange={(e) => updateRow(size, "mp", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={rows[size].sales}
                    onChange={(e) => updateRow(size, "sales", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={rows[size].stock}
                    onChange={(e) => updateRow(size, "stock", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button className="btn-add" onClick={handleAdd} disabled={isSaving}>
          {isSaving ? "Saving..." : "Add as new"}
        </button>
      </div>
    </div>
  );
}
