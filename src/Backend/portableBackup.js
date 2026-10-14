import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ZipArchive } from "archiver";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const PORTABLE_BACKUP_VERSION = 1;
const DATABASE_FILENAME = "inventory.db";

function assertPathInside(parent, child) {
  const resolvedParent = path.resolve(parent) + path.sep;
  const resolvedChild = path.resolve(child);
  if (resolvedChild !== path.resolve(parent) && !resolvedChild.startsWith(resolvedParent)) {
    throw new Error("The portable backup contains an unsafe file path.");
  }
}

function writeArchive(destination, entries, directoryEntry) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destination, { flags: "wx" });
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const onError = (error) => reject(error);
    output.on("close", resolve);
    output.on("error", onError);
    archive.on("error", onError);
    archive.pipe(output);
    for (const entry of entries) archive.append(entry.content, { name: entry.name });
    if (directoryEntry) archive.directory(directoryEntry.path, directoryEntry.name);
    archive.finalize().catch(reject);
  });
}

export async function createPortableBackup(db, dataDirectory, destinationPath, appVersion) {
  if (!db.open) throw new Error("The active database is not open.");
  const destination = path.resolve(destinationPath);
  if (path.resolve(db.name) === destination) {
    throw new Error("Choose a different file from the active database.");
  }

  const temporaryDirectory = fs.mkdtempSync(path.join(dataDirectory, ".stockwise-backup-"));
  const temporaryDatabase = path.join(temporaryDirectory, DATABASE_FILENAME);
  const temporaryArchive = `${destination}.${Date.now()}.tmp`;
  const imagesPath = path.join(dataDirectory, "images");
  try {
    await db.backup(temporaryDatabase);
    const manifest = {
      format: "stockwise-portable-backup",
      formatVersion: PORTABLE_BACKUP_VERSION,
      appVersion: appVersion || null,
      schemaVersion: db.pragma("user_version", { simple: true }),
      createdAt: new Date().toISOString(),
      includesImages: fs.existsSync(imagesPath),
    };
    await writeArchive(
      temporaryArchive,
      [
        { name: "backup-manifest.json", content: `${JSON.stringify(manifest, null, 2)}\n` },
        { name: DATABASE_FILENAME, content: fs.readFileSync(temporaryDatabase) },
      ],
      fs.existsSync(imagesPath) ? { path: imagesPath, name: "images" } : null,
    );
    fs.renameSync(temporaryArchive, destination);
    return destination;
  } catch (error) {
    fs.rmSync(temporaryArchive, { force: true });
    throw new Error("Could not create the portable StockWise backup.", { cause: error });
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

export function stagePortableRestore(sourcePath, stagingDirectory) {
  const source = path.resolve(sourcePath);
  const staging = path.resolve(stagingDirectory);
  fs.mkdirSync(staging, { recursive: true });
  const extraction = path.join(staging, "archive");
  fs.mkdirSync(extraction);

  try {
    const zip = new AdmZip(source);
    for (const entry of zip.getEntries()) {
      const entryPath = path.join(extraction, entry.entryName);
      assertPathInside(extraction, entryPath);
    }
    zip.extractAllTo(extraction, true);

    const manifestPath = path.join(extraction, "backup-manifest.json");
    if (!fs.existsSync(manifestPath)) throw new Error("This file is missing the StockWise backup manifest.");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (manifest.format !== "stockwise-portable-backup" || manifest.formatVersion !== PORTABLE_BACKUP_VERSION) {
      throw new Error("This portable backup format is not supported by this version of StockWise.");
    }

    const databasePath = path.join(extraction, DATABASE_FILENAME);
    if (!fs.existsSync(databasePath)) throw new Error("This portable backup does not contain a database.");
    const imagesPath = path.join(extraction, "images");
    return { databasePath, imagesPath: fs.existsSync(imagesPath) ? imagesPath : null, manifest };
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw new Error(error.message || "Could not read the portable StockWise backup.", { cause: error });
  }
}
