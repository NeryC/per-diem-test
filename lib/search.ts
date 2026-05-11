export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/([a-z])\1+/g, "$1")
    .trim();
}

export function matchesQuery(
  haystackParts: Array<string | null>,
  query: string,
): boolean {
  if (query.length === 0) return true;
  const tokens = normalize(query)
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return true;
  const normalizedParts = haystackParts
    .filter((p): p is string => p !== null)
    .map((p) => normalize(p));
  return tokens.every((tok) =>
    normalizedParts.some((part) => part.includes(tok)),
  );
}
