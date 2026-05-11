import "server-only";
import { SquareError } from "square";

/**
 * Discriminated union the route handlers and the UI can both exhaust.
 * The Square SDK throws SquareError with a mixed body shape; we narrow
 * once at the boundary so the rest of the proxy stays linear.
 */
export type SquareProxyError =
  | { kind: "rate_limited"; retryAfterSeconds: number }
  | { kind: "unauthorized" }
  | { kind: "not_found" }
  | { kind: "server_error"; status: number }
  | { kind: "network" };

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: SquareProxyError };

/** Default if Retry-After header is missing on a 429 response. */
const DEFAULT_RETRY_AFTER_SECONDS = 1;

function readRetryAfter(err: SquareError): number {
  const headers = err.rawResponse?.headers;
  if (!headers) return DEFAULT_RETRY_AFTER_SECONDS;
  const value = headers.get("retry-after");
  if (value === null) return DEFAULT_RETRY_AFTER_SECONDS;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0)
    return DEFAULT_RETRY_AFTER_SECONDS;
  return parsed;
}

export function mapSquareError(err: unknown): SquareProxyError {
  if (err instanceof SquareError) {
    const status = err.statusCode ?? 0;
    if (status === 429) {
      return { kind: "rate_limited", retryAfterSeconds: readRetryAfter(err) };
    }
    if (status === 401 || status === 403) {
      return { kind: "unauthorized" };
    }
    if (status === 404) {
      return { kind: "not_found" };
    }
    if (status >= 500 && status <= 599) {
      return { kind: "server_error", status };
    }
    // Any other 4xx from Square is bad input on our side; surface as
    // server_error so we never leak Square's status to our client.
    if (status >= 400 && status <= 499) {
      return { kind: "server_error", status };
    }
  }
  return { kind: "network" };
}

/**
 * Wraps a Square SDK call so callers don't litter try/catch through the
 * proxy. The Result type forces the caller to handle the error branch.
 */
export async function safeSquareCall<T>(
  fn: () => Promise<T>,
): Promise<Result<T>> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: mapSquareError(err) };
  }
}
