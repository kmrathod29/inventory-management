import "../Styles/editconsoledialog.css";
import { UpdateConsole } from "./UpdateConsole";
import { AddConsole } from "./AddConsole";
import { useState, useEffect, forwardRef } from "react";

export const EditConsole = forwardRef((props, ref) => {
  const { editingItem } = props;
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
        <UpdateConsole product={product} setProduct={setProduct} />
      ) : (
        <AddConsole />
      )}
    </dialog>
  );
});