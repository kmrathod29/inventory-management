import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createDatabaseBackup, stageDatabaseRestore, activateStagedDatabase } from "../databaseBackup.js";
import { createPortableBackup, stagePortableRestore } from "../portableBackup.js";
import { exportData as createDataExport } from "../dataExport.js";

export function createBackupService(ctx) {
function backupDatabase(destinationPath) {
  return createDatabaseBackup(ctx.db, destinationPath);
}

function exportDatabase(destinationPath, selections, appVersion) {
  return createDataExport(ctx.db, destinationPath, selections, appVersion);
}

function createPortableDatabaseBackup(destinationPath, appVersion) {
  return createPortableBackup(ctx.db, ctx.dataDirectory, destinationPath, appVersion);
}

async function restoreDatabase(sourcePath) {
  const source = path.resolve(sourcePath);
  if (source === path.resolve(ctx.dbPath)) {
    throw new Error("Choose a backup file, not the active database.");
  }

  const stagingDirectory = fs.mkdtempSync(
    path.join(path.dirname(ctx.dbPath), ".stockwise-restore-"),
  );
  const stagingPath = path.join(stagingDirectory, "restored.db");
  const previousPath = path.join(stagingDirectory, "previous.db");
  const recoveryName = `StockWise-Recovery-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.db`;
  const recoveryPath = path.join(path.dirname(ctx.dbPath), recoveryName);

  try {
    await stageDatabaseRestore(source, stagingPath);
    await createDatabaseBackup(ctx.db, recoveryPath);

    ctx.db.close();
    try {
      activateStagedDatabase(ctx.dbPath, stagingPath, previousPath);
    } catch (error) {
      try {
        ctx.openDatabase();
      } catch (reopenError) {
        throw new AggregateError(
          [error, reopenError],
          "Restore failed and the active database could not be reopened.",
          { cause: reopenError },
        );
      }
      throw error;
    }

    return { recoveryBackupPath: recoveryPath };
  } finally {
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
  }
}

async function restorePortableDatabase(sourcePath) {
  const stagingDirectory = fs.mkdtempSync(path.join(path.dirname(ctx.dbPath), ".stockwise-portable-restore-"));
  const stagedDatabasePath = path.join(stagingDirectory, "restored.db");
  const stagedImagesPath = path.join(stagingDirectory, "images");
  const previousDatabasePath = path.join(stagingDirectory, "previous.db");
  const previousImagesPath = path.join(stagingDirectory, "previous-images");
  const recoveryName = `StockWise-Recovery-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.db`;
  const recoveryPath = path.join(path.dirname(ctx.dbPath), recoveryName);
  let replacedImages = false;

  try {
    const staged = stagePortableRestore(sourcePath, stagingDirectory);
    await stageDatabaseRestore(staged.databasePath, stagedDatabasePath);
    if (staged.imagesPath) fs.cpSync(staged.imagesPath, stagedImagesPath, { recursive: true });
    await createDatabaseBackup(ctx.db, recoveryPath);

    ctx.db.close();
    try {
      fs.renameSync(ctx.dbPath, previousDatabasePath);
      const activeImagesPath = path.join(ctx.dataDirectory, "images");
      if (fs.existsSync(activeImagesPath)) {
        fs.renameSync(activeImagesPath, previousImagesPath);
        replacedImages = true;
      }
      fs.renameSync(stagedDatabasePath, ctx.dbPath);
      if (fs.existsSync(stagedImagesPath)) fs.renameSync(stagedImagesPath, activeImagesPath);
      ctx.openDatabase();
    } catch (error) {
      if (ctx.db?.open) ctx.db.close();
      if (fs.existsSync(ctx.dbPath)) fs.rmSync(ctx.dbPath, { force: true });
      if (fs.existsSync(previousDatabasePath)) fs.renameSync(previousDatabasePath, ctx.dbPath);
      if (replacedImages && fs.existsSync(previousImagesPath)) {
        fs.rmSync(path.join(ctx.dataDirectory, "images"), { recursive: true, force: true });
        fs.renameSync(previousImagesPath, path.join(ctx.dataDirectory, "images"));
      }
      ctx.openDatabase();
      throw error;
    }

    return { recoveryBackupPath: recoveryPath, includesImages: Boolean(staged.imagesPath) };
  } finally {
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
  }
}

  return {
    backupDatabase,
    exportDatabase,
    createPortableDatabaseBackup,
    restoreDatabase,
    restorePortableDatabase,
  };
}
