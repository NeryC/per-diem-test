import "server-only";
import { NextResponse } from "next/server";
import type { SquareProxyError } from "./errors";

export interface JsonResponseInit {
  /**
   * If set, emits Cache-Control with stale-while-revalidate at twice the
   * fresh window. Per-endpoint TTLs are declarative at the call site.
   */
  revalidateSeconds?: number;
  status?: number;
}

export function jsonResponse<T>(
  payload: T,
  init: JsonResponseInit = {},
): NextResponse {
  const headers = new Headers({ "content-type": "application/json" });
  if (init.revalidateSeconds !== undefined) {
    const fresh = init.revalidateSeconds;
    const swr = fresh * 2;
    headers.set(
      "cache-control",
      `public, s-maxage=${fresh}, stale-while-revalidate=${swr}`,
    );
  }
  return new NextResponse(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers,
  });
}

/**
 * Owns the SquareProxyError -> HTTP mapping in one place so every route
 * handler stays consistent. We deliberately mask Square's 4xx (other than
 * 404) as 502 — those are server-side problems from our client's POV.
 */
export function errorResponse(error: SquareProxyError): NextResponse {
  switch (error.kind) {
    case "rate_limited":
      return new NextResponse(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(error.retryAfterSeconds),
        },
      });
    case "unauthorized":
      // Token problem on our side; never surface as 401 to the client.
      return jsonResponse({ error: "upstream_unauthorized" }, { status: 502 });
    case "not_found":
      return jsonResponse({ error: "not_found" }, { status: 404 });
    case "server_error":
      return jsonResponse(
        { error: "upstream_error", upstreamStatus: error.status },
        { status: 502 },
      );
    case "network":
      return jsonResponse({ error: "upstream_unreachable" }, { status: 502 });
  }
}
