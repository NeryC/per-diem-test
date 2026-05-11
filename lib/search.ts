export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
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
  const haystack = haystackParts
    .filter((p): p is string => p !== null && p !== undefined)
    .map(normalize)
    .join(" ");
  return tokens.every((t) => haystack.includes(t));
}
