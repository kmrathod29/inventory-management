# StockWise

##### Inventory Manager App

A simple, modern inventory manager built for small, local businesses. StockWise lets you manage your product catalog, track stock levels across multiple product bases and sizes, create bills and invoices, and keep tabs on customer payments — all from a clean, offline desktop app.

No internet connection required. All data is stored locally on your machine.

## Regional defaults

The current regional presentation uses India (`IN`), INR (`₹`), `en-IN`, Gregorian dates displayed as `DD/MM/YYYY`, and Asia/Kolkata business dates. Financial year reporting starts on 1 April. Existing database values have not been converted: historical currency, tax, and calendar meaning must be verified before production use. Legacy PAN/VAT bill records are not Indian GST documents.

---

## Built With

```
Frontend : React JS + HTML + CSS
Backend  : Node.js (Electron main process)
Database : SQLite (via better-sqlite3)
Runtime  : Electron
Bundler  : Vite
```

---

## How to Run (Development)

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

#### Node

Only works with electron version 38.7.0!

### Steps

1. Clone the repository:

   ```bash
   git clone https://github.com/kmrathod29/inventory-management.git
   cd inventory-management
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Rebuild native modules for Electron:

   ```bash
   npx @electron/rebuild
   ```

4. Start the app in development mode:

   ```bash
   npm run dev
   ```

### Build the Installer

Native modules must be rebuilt on the same platform as the installer. In
particular, do not run a Windows build with `--win` from Linux or copy a
Linux-built `better_sqlite3.node` into a Windows package.

On Windows, build the `.exe` with:

```bash
npm ci
npm run build:win
```

On Linux, build the AppImage with:

```bash
npm ci
npm run build:linux
```

The output will be in the `release/` folder. Build each platform on its
native GitHub Actions runner for release uploads.

---

## Pages and Features

### 1. Dashboard

- Quick overview of all products in your catalog
- Browse products by bucket size with live price display
- Quick billing shortcut
- Easy navigation between pages

### 2. Inventory

- Detailed view of every product with all variants and bases
- Check stock levels per base per variant
- Compare landing, market, and sales prices side by side
- Add, edit, or remove products and their variants

### 3. Billing

- Create and update bills and invoices
- Track customer info and payment status
- View full bill history

### 4. Finances

- View and manage all business expenses
- Track two types of expenses: General expenses and Product imports
- **General Expenses**: Record operational costs (rent, utilities, salaries, etc.)
- **Import Expenses**: Track bulk product imports with detailed item-level breakdown
  - Record product name, base, bucket size, quantity, and cost price per item
  - Automatically calculate total import cost
  - Items are added to stock upon import
- View complete expense history with dates and amounts
- Edit or delete expense records as needed
- Use keyboard shortcuts (`Shift+Enter`) for rapid data entry

### 5. Analytics

- Real-time financial performance dashboard
- **Summary Statistics**:
  - Total revenue earned (monthly/yearly)
  - Operating expenses breakdown
  - Outstanding payables to customers
  - Net profit calculation
  - Profit margin percentage
  - Expense ratio analysis
  - Average profit per sale
  - Top performing product category
- **Top Performers**:
  - Top 5 products by revenue with units sold
  - Top 5 customers by total spending and order count
- **Recent Activity Feed**:
  - Last 8 transactions (sales and expenses)
  - Chronologically sorted with amounts and dates
- **Period Filtering**:
  - Switch between monthly and yearly views
  - All metrics update automatically
- Data sourced directly from database for real-time accuracy

---

## Keyboard Shortcuts

For faster data entry, the following keyboard shortcuts are available in dialogs:

### Available Shortcuts

| Shortcut | Dialog | Action |
| ---------- | -------- | -------- |
| `Shift+Enter` | Bill Dialog (Add Product) | Add product to bill and keep form open for more entries |
| `Shift+Enter` | Add Expense Dialog (Import Mode) | Add import item and clear form for next entry |
| `Shift+Enter` | Add Product Console | Add base name quickly |
| `Escape` | All Dialogs | Close dialog immediately |
| `Enter` | Add Product Console | Add base name (standard Enter also works) |

### How to Use

1. **Adding Products to Bills Quickly**
   - Open a bill and click "Add Product"
   - Fill in Product Name, Quantity, and Price
   - Press `Shift+Enter` to add the product
   - Form clears automatically, ready for the next product
   - Press `Escape` when done adding products

2. **Importing Multiple Items**
   - Open Add Expense dialog
   - Select "Import" type
   - Fill in product details (Name, Base, Size, Qty, Cost Price)
   - Press `Shift+Enter` to add item
   - Form clears, ready for next import item
   - Press `Escape` to close

3. **Adding Product Bases**
   - In Add Product, type base name (e.g., "AC1")
   - Press `Enter` or `Shift+Enter` to add
   - Type next base or close dialog with `Escape`

### Tips

- **Speed**: Use `Shift+Enter` to rapidly add multiple items without closing dialogs
- **Cancel**: Press `Escape` anytime to exit a dialog
- **Mouse Alternative**: All keyboard shortcuts complement mouse clicks - use whichever is faster
- **Standard Input**: All standard keyboard input (typing, backspace, etc.) works normally

---

## Data Storage

All data is stored locally in a SQLite database at `src/Database/inventory.db`. Product images are stored in `src/Database/images/`. Neither the database nor images are tracked by Git.

---

## License

Made for learning purpose.
No copyright.

## Credits

Developer: Midnight Sphere
