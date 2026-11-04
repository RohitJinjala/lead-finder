/**
 * Keyword pre-filter: before any AI call, drop posts that clearly match nothing
 * in the approved plan's keywords, or match its exclusion list.
 */

export interface FilterPlan {
  keywords: string[];
  exclusions: string[];
}

/**
 * Returns true if the lead should be KEPT (passes the filter).
 * Returns false if it should be dropped.
 */
export function passesKeywordFilter(
  title: string,
  body: string,
  plan: FilterPlan
): boolean {
  const text = `${title} ${body}`.toLowerCase();

  // If exclusion matches — always drop
  for (const exclusion of plan.exclusions) {
    if (text.includes(exclusion.toLowerCase())) return false;
  }

  // If no keywords configured — keep all (plan-less mode)
  if (plan.keywords.length === 0) return true;

  // Must match at least one keyword
  return plan.keywords.some((kw) => text.includes(kw.toLowerCase()));
}

