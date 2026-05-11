// Test-only shim: the real `server-only` package throws on any import outside
// React Server Components. Vitest aliases the package to this noop module so
// server modules under lib/square/* can be unit-tested in node.
export {};
