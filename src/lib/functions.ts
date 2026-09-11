/**
 * Preloaded function options for the combobox, plus the fuzzy match used to
 * nudge a custom value toward an existing option without ever overriding it.
 */

export const FUNCTION_OPTIONS: string[] = [
  "Board and governance",
  "Business development",
  "Clinical operations",
  "Communications",
  "Compliance",
  "Corporate development",
  "Customer success",
  "Engineering",
  "Facilities",
  "Finance",
  "Fundraising and development",
  "Grant writing",
  "HR and people",
  "Investor relations",
  "IT",
  "Legal",
  "Manufacturing",
  "Marketing",
  "Operations",
  "Procurement",
  "Product",
  "Program management",
  "Quality",
  "Recruiting",
  "Regulatory affairs",
  "Research",
  "Revenue operations",
  "Risk",
  "Sales",
  "Strategy",
  "Supply chain",
  "Tax",
  "Treasury",
];

export const MAX_FUNCTION_LENGTH = 60;

/** Words that stay upper case when we title case a custom value for display. */
const ACRONYMS = new Set([
  "IT",
  "HR",
  "IR",
  "QA",
  "RD",
  "R&D",
  "M&A",
  "ESG",
  "EHS",
  "PR",
  "BD",
  "GTM",
  "CX",
  "UX",
  "AI",
  "FP&A",
  "SEC",
  "EU",
  "US",
  "UK",
]);

/** Short words that stay lower case mid-phrase. */
const MINOR_WORDS = new Set(["and", "of", "the", "for", "in", "to", "or", "a", "an"]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Display form of a function label. The database keeps whatever the person
 * typed; this only changes how it reads on screen. An option that already
 * matches the preloaded list is returned in the list's own casing.
 */
export function displayFunctionLabel(raw: string): string {
  const cleaned = normalizeWhitespace(raw);
  if (!cleaned) return "";

  const canonical = FUNCTION_OPTIONS.find(
    (option) => option.toLowerCase() === cleaned.toLowerCase(),
  );
  if (canonical) return canonical;

  // Mixed case usually means the person typed it deliberately. Leave it alone.
  const isAllLower = cleaned === cleaned.toLowerCase();
  const isAllUpper = cleaned === cleaned.toUpperCase();
  if (!isAllLower && !isAllUpper) return cleaned;

  return cleaned
    .split(" ")
    .map((word, index) => {
      const bare = word.replace(/[^A-Za-z&]/g, "");
      if (ACRONYMS.has(bare.toUpperCase()) && bare.length <= 4) {
        return word.toUpperCase();
      }
      const lower = word.toLowerCase();
      if (index > 0 && MINOR_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function normalizeForMatch(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }
  return previous[b.length];
}

function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

/** Score in 0..1 blending whole-string closeness with word overlap. */
function score(candidate: string, option: string): number {
  const direct = similarity(candidate, option);

  const candidateWords = new Set(candidate.split(" ").filter((w) => w.length > 2));
  const optionWords = new Set(option.split(" ").filter((w) => w.length > 2));
  let shared = 0;
  for (const word of candidateWords) {
    if (optionWords.has(word)) shared += 1;
  }
  const union = new Set([...candidateWords, ...optionWords]).size;
  const overlap = union === 0 ? 0 : shared / union;

  // A clean containment ("ops" inside "operations") is a strong signal.
  const contained =
    candidate.length >= 3 && (option.includes(candidate) || candidate.includes(option)) ? 0.85 : 0;

  return Math.max(direct, overlap, contained);
}

export const FUZZY_MATCH_THRESHOLD = 0.72;

/**
 * Returns the closest preloaded option to a custom value, or null when the
 * value is already an exact option or nothing is close enough. The caller
 * suggests it. The person is always free to keep what they typed.
 */
export function suggestFunctionOption(raw: string): string | null {
  const candidate = normalizeForMatch(raw);
  if (candidate.length < 2) return null;

  let best: string | null = null;
  let bestScore = 0;

  for (const option of FUNCTION_OPTIONS) {
    const normalizedOption = normalizeForMatch(option);
    if (normalizedOption === candidate) return null; // already an exact option
    const value = score(candidate, normalizedOption);
    if (value > bestScore) {
      bestScore = value;
      best = option;
    }
  }

  return bestScore >= FUZZY_MATCH_THRESHOLD ? best : null;
}
