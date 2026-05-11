import { describe, expect, it } from "vitest";
import { SquareError } from "square";
import { mapSquareError, safeSquareCall } from "@/lib/square/errors";

/**
 * Build a SquareError that mimics what the SDK throws after a non-2xx
 * response. The SDK populates `statusCode` and (for rate-limited responses)
 * a `rawResponse` whose `headers` exposes a `retry-after` value.
 */
function makeSquareError(opts: {
  statusCode: number;
  retryAfter?: string;
}): SquareError {
  const headers = new Headers();
  if (opts.retryAfter !== undefined) {
    headers.set("retry-after", opts.retryAfter);
  }
  return new SquareError({
    statusCode: opts.statusCode,
    message: `HTTP ${opts.statusCode}`,
    rawResponse: {
      headers,
      redirected: false,
      status: opts.statusCode,
      statusText: `${opts.statusCode}`,
      type: "default",
      url: "https://connect.squareupsandbox.com/",
    },
  });
}

describe("mapSquareError", () => {
  it("maps 429 to rate_limited and reads Retry-After header", () => {
    const err = mapSquareError(
      makeSquareError({ statusCode: 429, retryAfter: "12" }),
    );
    expect(err.kind).toBe("rate_limited");
    if (err.kind === "rate_limited") {
      expect(err.retryAfterSeconds).toBe(12);
    }
  });

  it("falls back to default Retry-After when header is missing on a 429", () => {
    const err = mapSquareError(makeSquareError({ statusCode: 429 }));
    expect(err.kind).toBe("rate_limited");
    if (err.kind === "rate_limited") {
      expect(err.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("maps 401 to unauthorized", () => {
    const err = mapSquareError(makeSquareError({ statusCode: 401 }));
    expect(err.kind).toBe("unauthorized");
  });

  it("maps 404 to not_found", () => {
    const err = mapSquareError(makeSquareError({ statusCode: 404 }));
    expect(err.kind).toBe("not_found");
  });

  it("maps 5xx to server_error and preserves status", () => {
    const err = mapSquareError(makeSquareError({ statusCode: 503 }));
    expect(err.kind).toBe("server_error");
    if (err.kind === "server_error") {
      expect(err.status).toBe(503);
    }
  });

  it("maps unknown errors to network", () => {
    const err = mapSquareError(new Error("ECONNRESET"));
    expect(err.kind).toBe("network");
  });
});

describe("safeSquareCall", () => {
  it("returns ok with the resolved value", async () => {
    const result = await safeSquareCall(async () => 42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("returns err with mapped SquareError on failure", async () => {
    const result = await safeSquareCall(async () => {
      throw makeSquareError({ statusCode: 401 });
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("unauthorized");
    }
  });
});
