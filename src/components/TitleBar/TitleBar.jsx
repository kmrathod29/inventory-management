import "./TitleBar.css";

export function TitleBar() {
  return (
    <header className="title-bar" role="banner" aria-label="Application title bar">
      <span className="title-bar-text">
        Dipali Traders Inventory Management
      </span>
      <span className="title-bar-spacer" />
    </header>
  );
}
