const words = (text: string) => text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).map((v) => v.trim()).filter(Boolean);
const paragraphs = (text: string) => text.split(/\n\s*\n/).map((v) => v.trim()).filter(Boolean);
const syllables = (word: string) => {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return 1;
  const groups = normalized.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/i, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
};

export function analyseDeterministically(text: string, expectedFields: readonly string[] = []) {
  const tokens = words(text), sentenceList = sentences(text), paragraphList = paragraphs(text);
  const normalized = tokens.map((v) => v.toLocaleLowerCase("en"));
  const stop = new Set(["the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "is", "are", "was", "were", "be", "with", "that", "this", "as", "at", "by", "from"]);
  const frequencies = new Map<string, number>();
  for (const token of normalized) if (token.length > 2 && !stop.has(token)) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  const totalSyllables = tokens.reduce((sum, token) => sum + syllables(token), 0);
  const sentenceCount = Math.max(1, sentenceList.length), wordCount = tokens.length;
  const readingEase = wordCount ? 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (totalSyllables / wordCount) : 0;
  const dates = [...new Set(text.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s*\d{4})?)\b/gi) ?? [])];
  const quantities = [...new Set(text.match(/(?:[$£€]\s?\d[\d,.]*|\b\d+(?:\.\d+)?\s?%|\b\d[\d,.]*\b)/g) ?? [])].slice(0, 200);
  const lower = text.toLocaleLowerCase("en");
  return {
    syntax: { wordCount, sentenceCount: sentenceList.length, paragraphCount: paragraphList.length, averageSentenceWords: sentenceList.length ? Number((wordCount / sentenceList.length).toFixed(2)) : 0 },
    readability: { fleschReadingEase: Number(Math.max(0, Math.min(100, readingEase)).toFixed(1)), estimatedMinutes: Number((wordCount / 200).toFixed(1)) },
    terminology: [...frequencies.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 30).map(([term, count]) => ({ term, count })),
    facts: { dates, quantities },
    completeness: expectedFields.map((field) => ({ field, found: lower.includes(field.toLocaleLowerCase("en")) })),
  };
}
