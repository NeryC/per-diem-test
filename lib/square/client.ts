import "server-only";
import { SquareClient, SquareEnvironment } from "square";
import { requireEnv } from "./env";

/**
 * The square v44 SDK exposes `SquareClient` (formerly `Client`) and
 * `SquareEnvironment` (formerly `Environment`). Resource accessors moved from
 * `client.locationsApi` / `client.catalogApi` to `client.locations` /
 * `client.catalog`. Auth option is `token` rather than `accessToken`.
 *
 * server-only ensures any accidental import from a client component fails the
 * build instead of leaking the access token to the browser.
 *
 * The client is created lazily so importing this module (e.g. during
 * `next build`'s route collection) does not throw when SQUARE_ACCESS_TOKEN is
 * unset. The token is required at first request — requireEnv fails loudly
 * with a clear message rather than producing an unhelpful 401 from Square.
 */
let _square: SquareClient | undefined;

export function getSquareClient(): SquareClient {
  if (_square) return _square;
  const environment =
    process.env.SQUARE_ENVIRONMENT === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox;
  _square = new SquareClient({
    token: requireEnv("SQUARE_ACCESS_TOKEN"),
    environment,
  });
  return _square;
}
