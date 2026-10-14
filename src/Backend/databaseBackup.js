import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { migrateDatabase } from "./migrations.js";

const requiredColumns = {
  products: ["id", "name", "images"],
  variants: ["id", "product_id", "bucket_size", "landing", "sales", "mp"],
  bases: ["id", "product_id", "name"],
  base_stock: ["base_id", "variant_id", "stock"],
  customers: ["id", "name", "phone", "address", "notes"],
  expenses: ["id", "date", "label", "amount", "type", "invoice_data"],
  expense_items: ["id", "expense_id", "product_name", "base", "bucket_size", "quantity", "cost_price"],
  bills: ["id", "customer_id", "date", "payment_method", "total_purchased", "amount_paid", "amount_due", "status", "bill_type", "pan_number", "bill_number", "invoice_data"],
  bill_activity: ["id", "bill_id", "type", "date", "amount", "payment_method", "note", "created_at"],
  bill_items: ["id", "bill_id", "product_name", "base", "bucket_size", "quantity", "price_at_sale", "cost_price"],
};
const legacyIdentityColumns = {
  products: ["id", "name"],
  customers: ["id", "name"],
  bills: ["id", "customer_id"],
  bill_items: ["id", "bill_id", "product_name", "quantity", "price_at_sale"],
};

function assertDatabaseIntegrity(db) {
  const result = db.pragma("integrity_check", { simple: true });
  if (result !== "ok") {
    throw new Error(`SQLite integrity check failed: ${result}`);
  }
}

function assertStockWiseDatabase(db, requireCurrentSchema = false) {
  const expectedColumns = requireCurrentSchema ? requiredColumns : legacyIdentityColumns;
  const tables = new Set(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
      .map((row) => row.name),
  );
  const invalidTables = Object.entries(expectedColumns).filter(([table, columns]) => {
    if (!tables.has(table)) return true;
    const presentColumns = new Set(
      db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name),
    );
    return columns.some((column) => !presentColumns.has(column));
  });

  if (invalidTables.length > 0) {
    throw new Error("The selected file does not contain a complete StockWise database schema.");
  }
}

export async function createDatabaseBackup(db, destinationPath) {
  if (!db.open) {
    throw new Error("The active database is not open.");
  }

  const destination = path.resolve(destinationPath);
  if (db.name && path.resolve(db.name) === destination) {
    throw new Error("Choose a different file from the active database.");
  }

  await db.backup(destination);
  return destination;
}

export async function stageDatabaseRestore(sourcePath, stagingPath) {
  const source = path.resolve(sourcePath);
  const staging = path.resolve(stagingPath);
  if (source === staging) {
    throw new Error("The restore source and staging file must be different.");
  }
  if (fs.existsSync(staging)) {
    throw new Error("The restore staging file already exists.");
  }

  try {
    const sourceDb = new Database(source, { readonly: true, fileMustExist: true });
    try {
      assertDatabaseIntegrity(sourceDb);
      assertStockWiseDatabase(sourceDb);
      await sourceDb.backup(staging);
    } finally {
      sourceDb.close();
    }

    const stagedDb = new Database(staging);
    try {
      const schemaVersion = migrateDatabase(stagedDb);
      assertDatabaseIntegrity(stagedDb);
      assertStockWiseDatabase(stagedDb, true);
      return { schemaVersion };
    } finally {
      stagedDb.close();
    }
  } catch (error) {
    fs.rmSync(staging, { force: true });
    throw error;
  }
}

export function activateStagedDatabase(activePath, stagingPath, previousPath) {
  fs.renameSync(activePath, previousPath);
  try {
    fs.renameSync(stagingPath, activePath);
  } catch (error) {
    try {
      fs.renameSync(previousPath, activePath);
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Restore activation failed and the original database could not be put back.",
        { cause: rollbackError },
      );
    }
    throw new Error(error.message, { cause: error });
  }
}