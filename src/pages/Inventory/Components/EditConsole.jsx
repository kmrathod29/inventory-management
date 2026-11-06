import "../Styles/editconsoledialog.css";
import { AddConsole } from "./AddConsole";
import { useState, useEffect, forwardRef } from "react";

export const EditConsole = forwardRef((props, ref) => {
  const { editingItem, onClose, onSaved, products = [] } = props;
  const [product, setProduct] = useState(null);

  useEffect(() => {
    async function fetchProduct() {
      if (!editingItem) {
        setProduct(null);
        return;
      }
      const all = await window.db.getProducts();
      const found = all.find((p) => p.id === editingItem);
      setProduct(found ?? null);
    }
    fetchProduct();
  }, [editingItem]);

  return (
    <dialog ref={ref} className="edit-console">
      {product ? (
        <AddConsole key={product.id} product={product} products={products} setProduct={setProduct} onSaved={onSaved} onClose={onClose} />
      ) : (
        <AddConsole key="new-product" products={products} onSaved={onSaved} onClose={onClose} />
      )}
    </dialog>
  );
});
