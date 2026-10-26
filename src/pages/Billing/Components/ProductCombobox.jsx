import { useEffect, useMemo, useRef, useState } from "react";
import { rankProducts } from "../../../utils/fuzzySearch";
import { useResolvedImage } from "../../../hooks/resolvedImage";

const RENDER_CAP = 60; // max options rendered at once (searches all, shows top N)

function ProductSearchImage({ product }) {
  const image = useResolvedImage(product.images);
  return <img className="product-search-image" src={image} alt="" />;
}

function getProductPrice(product) {
  return product.variants?.[0]?.sales ?? product.variants?.[0]?.mp ?? 0;
}

function getProductStock(product) {
  return (product.bases ?? []).reduce(
    (total, base) =>
      total +
      (product.variants ?? []).reduce(
        (baseTotal, variant) => baseTotal + Number(base.stockMap?.[variant.id] ?? 0),
        0,
      ),
    0,
  );
}

// VS Code command-palette style product search. Instant fuzzy/partial filtering,
// arrow navigation, Enter selects, Esc closes the list. Mouse fully supported.
export function ProductCombobox({
  products,
  usageMap,
  query,
  onQueryChange,
  onSelect,
  disabled,
  inputRef,
  placeholder = "Search product… (type name)",
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevQuery, setPrevQuery] = useState(query);
  const optionRefs = useRef([]);

  const ranked = useMemo(
    () => rankProducts(products, query, usageMap),
    [products, query, usageMap],
  );
  const shown = ranked.slice(0, RENDER_CAP);

  // Reset the highlight to the top whenever the query changes (adjust state
  // during render — cheaper and safer than a post-render effect).
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function choose(product) {
    onSelect?.(product);
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (disabled) return;
    if (e.shiftKey && e.key === "Enter") return; // global "add item"

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => open ? Math.min(i + 1, shown.length - 1) : 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => open ? Math.max(i - 1, 0) : Math.max(shown.length - 1, 0));
        break;
      case "Enter":
        if (open && shown[activeIndex]) {
          e.preventDefault();
          choose(shown[activeIndex]);
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          e.stopPropagation(); // close list only, don't close the dialog
          setOpen(false);
        }
        break;
      default:
        break;
    }
  }

  return (
    <div className={`product-combobox${open ? " is-open" : ""}`}>
      <input
        ref={inputRef}
        type="text"
        className="combobox-input"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[activeIndex] ? `pc-opt-${activeIndex}` : undefined}
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => {
          onQueryChange?.(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      />

      {open && shown.length > 0 && (
        <ul className="combobox-listbox" role="listbox">
          {shown.map((product, i) => {
            return (
              <li
                key={product.id}
                id={`pc-opt-${i}`}
                ref={(el) => (optionRefs.current[i] = el)}
                role="option"
                aria-selected={i === activeIndex}
                className={`combobox-option ${i === activeIndex ? "active" : ""}`}
                onMouseDown={(e) => e.preventDefault()} // keep input focused
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => choose(product)}
              >
                <ProductSearchImage product={product} />
                <span className="combobox-option-details">
                  <strong className="combobox-option-name">{product.name}</strong>
                  <span className="combobox-option-stock">
                    {product.sku_code || "No SKU"} · Stock: {getProductStock(product)}
                  </span>
                </span>
                <span className="combobox-option-price">
                  {Number(getProductPrice(product)).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <button
                  type="button"
                  className="combobox-add-button"
                  aria-label={`Add ${product.name}`}
                  disabled={disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    choose(product);
                  }}
                >
                  +
                </button>
              </li>
            );
          })}
          {ranked.length > shown.length && (
            <li className="combobox-footer" aria-hidden="true">
              Showing {shown.length} of {ranked.length} — keep typing to narrow
            </li>
          )}
        </ul>
      )}

      {open && query.trim() !== "" && shown.length === 0 && (
        <ul className="combobox-listbox" role="listbox">
          <li className="combobox-empty" aria-hidden="true">
            No products match “{query}”
          </li>
        </ul>
      )}
    </div>
  );
}
