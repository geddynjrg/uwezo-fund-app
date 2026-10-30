import {
  GROUP_ACTIVITY_OPTIONS,
  GROUP_PURPOSE_OPTIONS,
  type TaxonomyOption,
  VALUE_CHAIN_OPTIONS,
} from '../data/loanTaxonomySnapshot';

/** Join multi-select term names for ApplicationDraft string fields. */
export function joinTaxonomyValues(values: string[]): string {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].join(' | ');
}

/**
 * Parse a stored groupPurpose / groupActivities / valueChain string back to
 * selected option values. Supports `|` joins and legacy free-text / commas.
 */
export function parseTaxonomyValues(stored: string, options: TaxonomyOption[]): string[] {
  const raw = stored.trim();
  if (!raw) return [];

  const optionValues = options.map((option) => option.value);
  const byPipe = raw
    .split(/\s*\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const matchedPipe = byPipe.filter((part) => optionValues.includes(part));
  if (matchedPipe.length > 0) return [...new Set(matchedPipe)];

  const matchedContained = optionValues.filter(
    (value) => raw === value || raw.includes(value),
  );
  if (matchedContained.length > 0) {
    // Prefer longer matches first so "Value chain" beats accidental substrings.
    matchedContained.sort((a, b) => b.length - a.length);
    const picked: string[] = [];
    let rest = raw;
    for (const value of matchedContained) {
      if (rest.includes(value)) {
        picked.push(value);
        rest = rest.replace(value, ' ');
      }
    }
    return [...new Set(picked)];
  }

  // Legacy free-text: keep as opaque single selection so validation still passes.
  return [raw];
}

export function toggleTaxonomyValue(stored: string, optionValue: string, options: TaxonomyOption[]): string {
  const current = parseTaxonomyValues(stored, options).filter((value) =>
    options.some((option) => option.value === value),
  );
  const next = current.includes(optionValue)
    ? current.filter((value) => value !== optionValue)
    : [...current, optionValue];
  return joinTaxonomyValues(next);
}

export function taxonomyIncludes(stored: string, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return false;
  return parseTaxonomyValues(stored, [
    ...GROUP_ACTIVITY_OPTIONS,
    ...GROUP_PURPOSE_OPTIONS,
    ...VALUE_CHAIN_OPTIONS,
    { label: term, value: term },
  ]).some((value) => value.toLowerCase() === needle);
}

export function activityShowsValueChain(stored: string): boolean {
  return taxonomyIncludes(stored, 'Value chain');
}

export function activityShowsTableBanking(stored: string): boolean {
  return taxonomyIncludes(stored, 'Table banking');
}

export function activityShowsOther(stored: string): boolean {
  return taxonomyIncludes(stored, 'Other');
}
