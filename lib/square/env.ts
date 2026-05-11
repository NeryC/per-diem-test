import "server-only";

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env var: ${name}. See .env.example.`);
  }
  return v;
}
