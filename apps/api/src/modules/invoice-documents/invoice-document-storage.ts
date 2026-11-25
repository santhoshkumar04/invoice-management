import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_STORAGE_DIR = "./storage/invoice-documents";

function getStorageRoot(): string {
  return path.resolve(
    process.cwd(),
    process.env.INVOICE_DOCUMENT_STORAGE_DIR || DEFAULT_STORAGE_DIR,
  );
}

function resolveStoragePath(storageKey: string): string {
  if (
    !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i.test(storageKey)
  ) {
    throw new Error("INVALID_DOCUMENT_STORAGE_KEY");
  }

  const root = getStorageRoot();
  const resolved = path.resolve(root, storageKey);

  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("INVALID_DOCUMENT_STORAGE_KEY");
  }

  return resolved;
}

export async function storeInvoicePdf(
  invoiceId: string,
  buffer: Buffer,
): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) {
    throw new Error("INVALID_INVOICE_ID");
  }

  const storageKey = `${invoiceId}/${randomUUID()}.pdf`;
  const filePath = resolveStoragePath(storageKey);

  await mkdir(path.dirname(filePath), {
    recursive: true,
  });

  await writeFile(filePath, buffer, {
    flag: "wx",
    mode: 0o600,
  });

  return storageKey;
}

export async function readInvoicePdf(
  storageKey: string,
): Promise<Buffer> {
  const filePath = resolveStoragePath(storageKey);
  return readFile(filePath);
}

export async function deleteInvoicePdf(
  storageKey: string,
): Promise<void> {
  const filePath = resolveStoragePath(storageKey);

  try {
    await unlink(filePath);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}
