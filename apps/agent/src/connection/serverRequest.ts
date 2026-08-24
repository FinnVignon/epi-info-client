import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { ServerApiError } from "./serverApiError.js";

export async function requestServerJson(
  url: string,
  init: RequestInit,
  requestTimeoutMs: number,
): Promise<unknown> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: abortController.signal });
    const body = await readResponseBody(response);

    if (!response.ok) {
      throw createResponseError(response, body);
    }

    return body;
  } catch (error) {
    throw normalizeRequestError(error);
  } finally {
    clearTimeout(timeout);
  }
}

export async function downloadServerFile(
  url: string,
  headers: Record<string, string>,
  destinationPath: string,
  requestTimeoutMs: number,
): Promise<void> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, {
      headers,
      method: "GET",
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw createResponseError(response, await readResponseBody(response));
    }

    if (!response.body) {
      throw new ServerApiError("Server returned an empty asset response", response.status);
    }

    await pipeline(Readable.fromWeb(response.body), createWriteStream(destinationPath));
  } catch (error) {
    throw normalizeRequestError(error, "Unable to download asset");
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ServerApiError("Server returned an invalid JSON response", response.status);
  }
}

function createResponseError(response: Response, body: unknown): ServerApiError {
  return new ServerApiError(
    readErrorMessage(body),
    response.status,
    readRetryAfterSeconds(response.headers.get("retry-after")),
  );
}

function normalizeRequestError(error: unknown, fallback = "Unable to contact the server"): Error {
  if (error instanceof ServerApiError) {
    return error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new ServerApiError("Server request timed out", null);
  }

  return new ServerApiError(error instanceof Error ? error.message : fallback, null);
}

function readErrorMessage(body: unknown): string {
  return typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : "Server request failed";
}

function readRetryAfterSeconds(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number.parseInt(value, 10);

  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}
