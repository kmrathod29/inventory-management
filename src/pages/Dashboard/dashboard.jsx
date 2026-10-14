import "./Styles/dashboard.css";
import { NavBar } from "../../components/navbar.jsx";
import { ProductCard } from "./Components/ProductCard.jsx";
import { useState, useEffect } from "react";
import { useErrorHandler } from "../../hooks/useErrorHandler";
import { useDataChanged } from "../../hooks/useDataChanged";

export function DashboardPage() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const { handleAsync } = useErrorHandler();

  useEffect(() => {
    let cancelled = false;
    async function fetchProducts() {
      const data = await handleAsync(
        () => window.db.getProducts(),
        "Failed to load products"
      );
      if (!cancelled && data) {
        setProducts(data);
      }
    }
    fetchProducts();
    return () => { cancelled = true; };
  }, [handleAsync]);

  useDataChanged(() => {
    return handleAsync(() => window.db.getProducts(), "Failed to refresh products")
      .then((data) => {
        if (data) setProducts(data);
      });
  });

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <NavBar
        search={search}
        setSearch={setSearch}
      />
      <ProductContainer products={filteredProducts}/>
    </>
  );
}

function ProductContainer({products}) {
  return (
    <div className="products-container">
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
