import { open, readFile, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export async function readJsonFile(pathname: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(pathname, "utf8")) as unknown;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return null;
    }

    throw error;
  }
}

export async function writeJsonFileAtomically(pathname: string, value: unknown): Promise<void> {
  const temporaryPath = `${pathname}.${process.pid}.${randomUUID()}.tmp`;
  let fileHandle: Awaited<ReturnType<typeof open>> | null = null;

  try {
    fileHandle = await open(temporaryPath, "wx", 0o600);
    await fileHandle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = null;
    await rename(temporaryPath, pathname);
    await syncDirectory(path.dirname(pathname));
  } catch (error) {
    await fileHandle?.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function removeJsonFile(pathname: string): Promise<void> {
  await rm(pathname, { force: true });
  await syncDirectory(path.dirname(pathname));
}

async function syncDirectory(directoryPath: string): Promise<void> {
  const directoryHandle = await open(directoryPath, "r");

  try {
    await directoryHandle.sync();
  } finally {
    await directoryHandle.close();
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
