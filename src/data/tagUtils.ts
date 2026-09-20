// Trims surrounding whitespace and collapses internal runs of whitespace;
// keeps the user's casing for display (comparison is done case-insensitively
// by normalizeTags/dedupe below).
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

// Deduplicates case-insensitively (keeping the first occurrence's casing)
// and drops empty entries — see CLAUDE.md "tags avec suggestions...
// normalisation : espaces retirés, pas de doublons insensibles à la casse".
export function normalizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of rawTags) {
    const tag = normalizeTag(raw)
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(tag)
  }
  return result
}

// Tag suggestions for a pattern's tag editor: every distinct tag already
// used across the library, excluding ones already applied to this pattern.
export function suggestTags(allTags: string[], currentTags: string[]): string[] {
  const current = new Set(currentTags.map((tag) => tag.toLowerCase()))
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of allTags) {
    const key = tag.toLowerCase()
    if (current.has(key) || seen.has(key)) continue
    seen.add(key)
    result.push(tag)
  }
  return result.sort((a, b) => a.localeCompare(b))
}
