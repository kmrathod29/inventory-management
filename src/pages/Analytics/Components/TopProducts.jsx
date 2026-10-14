export function TopProducts({ Card, Eyebrow, products = [] }) {
  const displayProducts = products.length > 0 ? products : [];
  const max = displayProducts.length > 0 ? Math.max(...displayProducts.map((p) => p.revenue)) : 1;
  return (
    <Card style={{width: "48%"}}>
      <Eyebrow
        color="var(--info)"
        tint="color-mix(in srgb, var(--info) 14%, transparent)"
      >
        best sellers
      </Eyebrow>
      <h3 className="card-title">Top products</h3>

      <div className="item-list">
        {displayProducts.map((p, i) => (
          <div key={p.name}>
            <div className="product-row-top">
              <div className="analytics-product-info">
                <span className="product-index">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="product-analytics-name">{p.name}</span>
              </div>
              <span className="product-units">{p.units} sold</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${(p.revenue / max) * 100}%`,
                  backgroundColor: "var(--info)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
