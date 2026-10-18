import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useToast } from "../../../hooks/ToastContext";
import { normalize } from "../../../utils/fuzzySearch";
import { commitMath } from "../../../utils/evalMath";
import { ProductCombobox } from "./ProductCombobox";
import { NumericMathInput } from "./NumericMathInput";
import { getBusinessDateISO } from "../../../utils/regional";

const blankForm = {
  productName: "",
  base: "",
  bucketSize: "",
  quantity: "1",
  priceAtSale: "",
};

// Keyboard-first Add Product overlay. Owns the product form + smart workflow
// (Product -> Base -> Size -> Quantity -> Price, auto-skipping single-option
// fields). Exposes addItem / clearForm / focusSearch via ref so BillDialog's
// global shortcut handler (Shift+Enter, Ctrl+Backspace) can drive it.
export const AddProductPanel = forwardRef(function AddProductPanel(
  { products, usageMap, sessionMemory, initial, onAdd, onReplace, onClose },
  ref,
) {
  const showToast = useToast();

  const [form, setForm] = useState(() =>
    initial?.item ? { ...blankForm, ...initial.item } : { ...blankForm },
  );
  const [query, setQuery] = useState(initial?.item?.productName ?? "");
  const [selectedProduct, setSelectedProduct] = useState(() =>
    initial?.item
      ? (products.find(
        (p) => p.sku_code === initial.item.skuCode || normalize(p.name) === normalize(initial.item.productName),
        ) ?? null)
      : null,
  );

  const searchRef = useRef(null);
  const baseRef = useRef(null);
  const sizeRef = useRef(null);
  const qtyRef = useRef(null);
  const priceRef = useRef(null);

  const isEdit = initial?.editIndex != null;
  const bases = selectedProduct?.bases ?? [];
  const sizes = selectedProduct?.variants ?? [];
  const [checkQuantity, setCheckQuantity] = useState(form.quantity);
  // Focus the search for a fresh add, or Quantity when prefilled (edit/clone).
  useEffect(() => {
    if (initial?.item) qtyRef.current?.focus();
    else searchRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── field navigation ──────────────────────────────────────────────
  function fieldSeq() {
    const seq = ["search"];
    if (bases.length > 1) seq.push("base");
    if (sizes.length > 1) seq.push("size");
    seq.push("qty", "price");
    return seq;
  }
  function focusName(name) {
    const map = {
      search: searchRef,
      base: baseRef,
      size: sizeRef,
      qty: qtyRef,
      price: priceRef,
    };
    map[name]?.current?.focus?.();
  }
  function navigate(fromName, dir) {
    const seq = fieldSeq();
    const idx = seq.indexOf(fromName);
    if (idx === -1) return;
    const nextIdx = dir === "next" ? idx + 1 : idx - 1;
    if (nextIdx >= 0 && nextIdx < seq.length) focusName(seq[nextIdx]);
  }

  // ── product selection + smart defaults ────────────────────────────
  function handleSelectProduct(product) {
    const remembered =
      sessionMemory?.current?.get(normalize(product.name)) ??
      usageMap?.get(normalize(product.name));
    const pBases = product.bases ?? [];
    const pSizes = product.variants ?? [];

    let base = "";
    if (pBases.length === 1) base = pBases[0].name;
    else if (
      pBases.length > 1 &&
      remembered?.lastBase &&
      pBases.some((b) => b.name === remembered.lastBase)
    )
      base = remembered.lastBase;

    let bucketSize = "";
    if (pSizes.length === 1) bucketSize = String(pSizes[0].bucket_size);
    else if (
      pSizes.length > 1 &&
      remembered?.lastSize &&
      pSizes.some((v) => String(v.bucket_size) === String(remembered.lastSize))
    )
      bucketSize = String(remembered.lastSize);

    setSelectedProduct(product);
    setQuery(product.name);
    setForm((f) => ({
      ...f,
      productName: product.name,
      base,
      bucketSize,
      quantity: f.quantity || "1",
    }));

    requestAnimationFrame(() => {
      if (pBases.length > 1) baseRef.current?.focus();
      else if (pSizes.length > 1) sizeRef.current?.focus();
      else qtyRef.current?.focus();
    });
  }

  function handleQueryChange(q) {
    setQuery(q);
    // Typing after a selection invalidates it (and any dependent base/size).
    if (selectedProduct && normalize(q) !== normalize(selectedProduct.name)) {
      setSelectedProduct(null);
      setForm((f) => ({ ...f, productName: q, base: "", bucketSize: "" }));
    } else {
      setForm((f) => ({ ...f, productName: q }));
    }
  }

  // ── add / replace ─────────────────────────────────────────────────
  function addItem(keepOpen) {
    if (!form.productName?.trim() || !form.quantity || !form.priceAtSale) {
      showToast("Please fill in product name, quantity, and price.");
      return;
    }
    const item = {
      productName: form.productName.trim(),
      skuCode: selectedProduct?.sku_code || form.skuCode || "",
      base: form.base,
      bucketSize: form.bucketSize,
      quantity: commitMath(form.quantity),
      priceAtSale: commitMath(form.priceAtSale),
      purchaseDate: getBusinessDateISO(),
    };

    if (sessionMemory?.current) {
      sessionMemory.current.set(normalize(item.productName), {
        lastBase: item.base,
        lastSize: item.bucketSize,
      });
    }

    if (isEdit) {
      onReplace?.(initial.editIndex, item);
      onClose?.();
      return;
    }

    onAdd?.(item);
    if (keepOpen) {
      setSelectedProduct(null);
      setQuery("");
      setForm({ ...blankForm });
      requestAnimationFrame(() => searchRef.current?.focus());
    } else {
      onClose?.();
    }
  }

  function clearForm() {
    setSelectedProduct(null);
    setQuery("");
    setForm({ ...blankForm });
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  useImperativeHandle(ref, () => ({
    addItem,
    clearForm,
    focusSearch: () => searchRef.current?.focus(),
  }));

  // Enter/Left/Right handling for the native Base/Size selects.
  function selectKeyDown(name) {
    return (e) => {
      if (e.shiftKey && e.key === "Enter") return; // global add
      if (e.key === "Enter") {
        e.preventDefault();
        navigate(name, "next");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigate(name, "prev");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.target.showPicker?.();
      }
    };
  }

  // Optional read-only stock hint for the chosen base + size.
  const selectedVariant = sizes.find(
    (v) => String(v.bucket_size) === String(form.bucketSize),
  );
  const selectedBase = bases.find((b) => b.name === form.base);
  const stock =
    selectedBase && selectedVariant
      ? (selectedBase.stockMap?.[selectedVariant.id] ?? null)
      : null;

  return (
    <div
      className="product-popup-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose?.();
      }}
    >
      <div
        className="product-popup add-product-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="add-product-head">
          <p className="section-label">
            {isEdit ? "Edit Product" : "Add Product"}
          </p>
          <div className="kbd-hint-bar">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> navigate
            </span>
            <span>
              <kbd>Enter</kbd> select
            </span>
            <span>
              <kbd>Shift</kbd>+<kbd>Enter</kbd> add &amp; next
            </span>
            <span>
              <kbd>Esc</kbd> close
            </span>
          </div>
        </div>

        <label className="panel-field-label">Product</label>
        <ProductCombobox
          products={products}
          usageMap={usageMap}
          query={query}
          onQueryChange={handleQueryChange}
          onSelect={handleSelectProduct}
          inputRef={searchRef}
        />

        {bases.length > 1 ? (
          <>
            <label className="panel-field-label">Base</label>
            <select
              ref={baseRef}
              value={form.base}
              onChange={(e) => setForm((f) => ({ ...f, base: e.target.value }))}
              onKeyDown={selectKeyDown("base")}
            >
              <option value="">Select a Base…</option>
              {bases.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </>
        ) : bases.length === 1 ? (
          <div className="auto-field">
            Base: <strong>{bases[0].name}</strong>{" "}
            <span className="auto-tag">auto</span>
          </div>
        ) : null}

        {sizes.length > 1 ? (
          <>
            <label className="panel-field-label">Size</label>
            <select
              ref={sizeRef}
              value={form.bucketSize}
              onChange={(e) =>
                setForm((f) => ({ ...f, bucketSize: e.target.value }))
              }
              onKeyDown={selectKeyDown("size")}
            >
              <option value="">Select a Size…</option>
              {sizes.map((v) => (
                <option key={v.id} value={String(v.bucket_size)}>
                  {v.bucket_size}
                </option>
              ))}
            </select>
          </>
        ) : sizes.length === 1 ? (
          <div className="auto-field">
            Size: <strong>{sizes[0].bucket_size}</strong>{" "}
            <span className="auto-tag">auto</span>
          </div>
        ) : null}

        <label className="panel-field-label">Quantity</label>
        <NumericMathInput
          ref={qtyRef}
          value={form.quantity}
          onChange={(v) => {
            setCheckQuantity(v);
            setForm((f) => ({ ...f, quantity: v }));
          }}
          onEnter={() => navigate("qty", "next")}
          onNavigate={(dir) => navigate("qty", dir)}
          stepper
          selectOnFocus
          placeholder="Quantity"
        />

        <label className="panel-field-label">Price of sale</label>
        <NumericMathInput
          ref={priceRef}
          value={form.priceAtSale}
          onChange={(v) => setForm((f) => ({ ...f, priceAtSale: v }))}
          onEnter={() => addItem(false)}
          onNavigate={(dir) => navigate("price", dir)}
          placeholder="Price (e.g. 5*100)"
        />

        {stock != null && <p className="stock-hint">In stock: {stock}</p>}

        <div className="product-popup-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              stock === "null" || stock < checkQuantity
                ? showToast(`Stocks too low: ${stock} item remaining`, "error")
                : addItem(false)
            }
          >
            {isEdit ? "Save Item" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
});
