/* global process */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const WORKER_START_TIMEOUT_MS = 60000;
let worker;
let nextRequestId = 0;

function failWorker(instance, error) {
  if (worker === instance) worker = null;
  clearTimeout(instance.startTimer);
  instance.readyReject?.(error);
  for (const request of instance.pending.values()) request.reject(error);
  instance.pending.clear();
}

function handleWorkerOutput(instance, line) {
  if (line === "READY") {
    clearTimeout(instance.startTimer);
    instance.readyResolve();
    return;
  }
  if (!line) return;

  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }

  if (message.type === "fatal") {
    failWorker(instance, new Error(message.error || "Microsoft Word could not be started."));
    instance.child.kill();
    return;
  }

  const request = instance.pending.get(message.id);
  if (!request) return;
  instance.pending.delete(message.id);
  if (message.ok) request.resolve();
  else request.reject(new Error(message.error || "Microsoft Word could not create the invoice PDF."));
}

function startWorker() {
  if (worker) return worker.ready;

  const script = `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$word = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  [Console]::Out.WriteLine('READY')
  while ($line = [Console]::In.ReadLine()) {
    $request = $null
    $document = $null
    try {
      $request = ConvertFrom-Json -InputObject $line
      if ([string]::IsNullOrWhiteSpace($request.docxPath) -or -not (Test-Path -LiteralPath $request.docxPath -PathType Leaf)) {
        throw 'The generated invoice document is missing or inaccessible.'
      }
      if ([string]::IsNullOrWhiteSpace($request.pdfPath)) {
        throw 'The destination PDF path is missing.'
      }
      $documents = $word.Documents
      if ($null -eq $documents) {
        throw 'Microsoft Word document service is unavailable.'
      }
      $document = $documents.Open($request.docxPath, $false, $true, $false)
      if ($null -eq $document) {
        throw 'Microsoft Word did not return an opened invoice document.'
      }
      $document.ExportAsFixedFormat($request.pdfPath, 17)
      $result = @{ id = $request.id; ok = $true }
    } catch {
      $lineNumber = $_.InvocationInfo.ScriptLineNumber
      $sourceLine = [string]$_.InvocationInfo.Line
      if ($sourceLine) { $sourceLine = $sourceLine.Trim() }
      $detail = $_.Exception.Message
      if ($lineNumber -and $sourceLine) {
        $detail = "\${detail} (PowerShell line \${lineNumber}: \${sourceLine})"
      }
      $result = @{ id = $request.id; ok = $false; error = $detail }
    } finally {
      if ($null -ne $document) {
        try { $document.Close($false) } catch { }
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) | Out-Null } catch { }
      }
    }
    [Console]::Out.WriteLine(($result | ConvertTo-Json -Compress -Depth 3))
  }
} catch {
  [Console]::Out.WriteLine((@{ type = 'fatal'; error = $_.Exception.Message } | ConvertTo-Json -Compress))
} finally {
  if ($word) {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
  }
}
`;

  const child = spawn("powershell.exe", [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-STA",
    "-Command",
    script,
  ], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const instance = {
    child,
    pending: new Map(),
    ready: null,
    readyResolve: null,
    readyReject: null,
    startTimer: null,
    stderr: "",
  };
  instance.ready = new Promise((resolve, reject) => {
    instance.readyResolve = resolve;
    instance.readyReject = reject;
  });
  instance.startTimer = setTimeout(() => {
    const error = new Error("Microsoft Word did not start in time.");
    failWorker(instance, error);
    child.kill();
  }, WORKER_START_TIMEOUT_MS);
  worker = instance;

  const output = createInterface({ input: child.stdout });
  output.on("line", (line) => handleWorkerOutput(instance, line));
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    instance.stderr = `${instance.stderr}${chunk}`.slice(-4000);
  });
  child.once("error", (error) => failWorker(instance, error));
  child.once("exit", (code, signal) => {
    const detail = instance.stderr.trim();
    const reason = detail
      ? `Microsoft Word conversion process exited: ${detail}`
      : `Microsoft Word conversion process exited (${signal || code}).`;
    failWorker(instance, new Error(reason));
  });

  return instance.ready;
}

export async function warmupWordPdfWorker() {
  if (process.platform !== "win32") {
    return Promise.reject(new Error("DOCX to PDF conversion currently requires Microsoft Word on Windows."));
  }
  return startWorker();
}

export async function convertDocxToPdf(docxPath, pdfPath) {
  if (process.platform !== "win32") {
    throw new Error("DOCX to PDF conversion currently requires Microsoft Word on Windows.");
  }
  await startWorker();
  const instance = worker;
  if (!instance || instance.child.stdin.destroyed) {
    throw new Error("Microsoft Word conversion process is unavailable. Try printing again.");
  }

  const id = ++nextRequestId;
  const result = new Promise((resolve, reject) => {
    instance.pending.set(id, { resolve, reject });
  });
  const request = instance.pending.get(id);
  instance.child.stdin.write(`${JSON.stringify({ id, docxPath, pdfPath })}\n`, (error) => {
    if (!error) return;
    instance.pending.delete(id);
    request.reject(error);
  });
  return result;
}

export function stopWordPdfWorker() {
  if (!worker) return;
  const instance = worker;
  worker = null;
  clearTimeout(instance.startTimer);
  instance.child.stdin.end();
}
