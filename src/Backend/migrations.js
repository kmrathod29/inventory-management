const migrations = [
  {
    version: 1,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          images TEXT
        );

        CREATE TABLE IF NOT EXISTS variants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id TEXT NOT NULL,
          bucket_size REAL NOT NULL,
          landing REAL,
          sales REAL,
          mp REAL,
          FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS bases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id TEXT NOT NULL,
          name TEXT NOT NULL,
          FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS base_stock (
          base_id INTEGER NOT NULL,
          variant_id INTEGER NOT NULL,
          stock REAL NOT NULL DEFAULT 0,
          PRIMARY KEY (base_id, variant_id),
          FOREIGN KEY (base_id) REFERENCES bases(id),
          FOREIGN KEY (variant_id) REFERENCES variants(id)
        );

        CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT,
          address TEXT,
          notes TEXT
        );

        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          label TEXT NOT NULL,
          amount REAL NOT NULL,
          type TEXT DEFAULT 'General'
        );

        CREATE TABLE IF NOT EXISTS expense_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expense_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          base TEXT,
          bucket_size REAL,
          quantity REAL NOT NULL,
          cost_price REAL NOT NULL,
          FOREIGN KEY (expense_id) REFERENCES expenses(id)
        );

        CREATE TABLE IF NOT EXISTS bills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL,
          date TEXT NOT NULL,
          payment_method TEXT,
          total_purchased REAL NOT NULL,
          amount_paid REAL NOT NULL,
          amount_due REAL NOT NULL,
          status TEXT NOT NULL,
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        );

        CREATE TABLE IF NOT EXISTS bill_activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bill_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          date TEXT NOT NULL,
          amount REAL NOT NULL DEFAULT 0,
          payment_method TEXT,
          note TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bill_id) REFERENCES bills(id)
        );

        CREATE TABLE IF NOT EXISTS bill_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bill_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          base TEXT,
          bucket_size REAL,
          quantity REAL NOT NULL,
          price_at_sale REAL NOT NULL,
          cost_price REAL DEFAULT 0,
          FOREIGN KEY (bill_id) REFERENCES bills(id)
        );
      `);

      const billItemColumns = db.prepare("PRAGMA table_info(bill_items)").all();
      if (!billItemColumns.some((column) => column.name === "cost_price")) {
        db.exec("ALTER TABLE bill_items ADD COLUMN cost_price REAL DEFAULT 0");
      }
    },
  },
  {
    version: 2,
    up(db) {
      const expenseColumns = db.prepare("PRAGMA table_info(expenses)").all();
      if (!expenseColumns.some((column) => column.name === "invoice_data")) {
        db.exec("ALTER TABLE expenses ADD COLUMN invoice_data TEXT");
      }
    },
  },
  {
    version: 3,
    up(db) {
      const tableExists = db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'bills'",
      ).get();
      if (!tableExists) return;
      const billColumns = db.prepare("PRAGMA table_info(bills)").all();
      const additions = [
        ["bill_type", "TEXT NOT NULL DEFAULT 'default'"],
        ["pan_number", "TEXT"],
        ["bill_number", "TEXT"],
        ["invoice_data", "TEXT"],
      ];
      for (const [column, definition] of additions) {
        if (!billColumns.some((row) => row.name === column)) {
          db.exec(`ALTER TABLE bills ADD COLUMN ${column} ${definition}`);
        }
      }
    },
  },
  {
    version: 4,
    up(db) {
      const tableExists = db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'customers'",
      ).get();
      if (!tableExists) return;
      const customerColumns = db.prepare("PRAGMA table_info(customers)").all();
      if (!customerColumns.some((column) => column.name === "notes")) {
        db.exec("ALTER TABLE customers ADD COLUMN notes TEXT");
      }
    },
  },
];

export function migrateDatabase(db) {
  let currentVersion = db.pragma("user_version", { simple: true });
  const latestVersion = migrations.at(-1)?.version ?? 0;

  if (currentVersion > latestVersion) {
    throw new Error(
      `Database schema version ${currentVersion} is newer than supported version ${latestVersion}.`,
    );
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;

    if (migration.version !== currentVersion + 1) {
      throw new Error(`Missing database migration for version ${currentVersion + 1}.`);
    }

    db.transaction(() => {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    })();

    currentVersion = migration.version;
  }

  return currentVersion;
}