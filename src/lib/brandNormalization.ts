/**
 * Canonicalizes raw OSM `brand` tags (typos, sub-brands, casing) into
 * display names. Shared by the filter matching and — conceptually — the
 * tile pipeline's manifest generator, which ports these same rules.
 * Keep the two in sync when editing.
 */
export const normalizeBrand = (raw: string): string | null => {
  const lower = raw.toLowerCase().trim();

  // Garbage / not a real brand → treat as unknown
  if (lower.startsWith('unk') || lower === 'unknown' || lower === 'generic'
    || lower === 'other' || lower.length <= 1 || lower.startsWith('wikidata')
    || lower.startsWith('q108') || lower === 'scm?') return null;

  // Flock Safety (typos: floc, flock safetu, flock saftey, flow safety, etc.)
  if (lower.startsWith('flock') || lower.startsWith('floc') || lower === 'flow safety') return 'Flock Safety';

  // Motorola Solutions (incl Vigilant sub-brand, typos: mortorola, motorolla)
  if (lower.startsWith('motor') || lower.startsWith('morto') || lower.startsWith('vigilant')) return 'Motorola Solutions';

  // Genetec (typo: genetech, product: AutoVu)
  if (lower.startsWith('genetec') || lower.startsWith('genete') || lower.startsWith('autovu')) return 'Genetec';

  // Leonardo (incl ELSAG sub-brand)
  if (lower.startsWith('leonardo') || lower.startsWith('elsag')) return 'Leonardo';

  // Rekor (typo: rektor)
  if (lower.startsWith('rekor') || lower === 'rektor') return 'Rekor';

  // Neology (incl PIPS)
  if (lower.startsWith('neology') || lower.startsWith('pips')) return 'Neology';

  // Axis Communications
  if (lower.startsWith('axis')) return 'Axis Communications';

  // Ekin
  if (lower.startsWith('ekin')) return 'Ekin';

  // Ubicquia
  if (lower.startsWith('ubicq')) return 'Ubicquia';

  // Avigilon
  if (lower.startsWith('avigilon')) return 'Avigilon';

  // Verkada
  if (lower.startsWith('verkada')) return 'Verkada';

  // Axon
  if (lower.startsWith('axon')) return 'Axon';

  // Kapsch
  if (lower.startsWith('kapsch')) return 'Kapsch';

  // LiveView Technologies (typos: lifeview, LVT)
  if (lower.startsWith('live') || lower.startsWith('life') || lower === 'lvt') return 'LiveView Technologies';

  // Insight LPR
  if (lower.startsWith('insight')) return 'Insight LPR';

  // Mobotix (typo: mobitix)
  if (lower.startsWith('mob')) return 'Mobotix';

  // Hanwha Vision
  if (lower.startsWith('hanwha')) return 'Hanwha Vision';

  // Cyber Secure (typos: yber secure)
  if (lower.includes('cyber') || lower.startsWith('yber')) return 'Cyber Secure';

  // Hikvision
  if (lower.startsWith('hikvision')) return 'Hikvision';

  // Dahua
  if (lower.startsWith('dahua')) return 'Dahua';

  // Redspeed
  if (lower.startsWith('redspeed')) return 'Redspeed';

  // Other known smaller brands
  if (lower.startsWith('mesa')) return 'Mesa Technologies';
  if (lower.startsWith('icamera')) return 'ICamera';
  if (lower.startsWith('epic')) return 'EPIC IO';
  if (lower.startsWith('transcore')) return 'TransCore';
  if (lower.startsWith('platesmart')) return 'PlateSmart';
  if (lower.startsWith('adaptive')) return 'Adaptive Recognition';
  if (lower.startsWith('ndi')) return 'NDI Recognition Systems';
  if (lower.startsWith('mav')) return 'Mav Systems';
  if (lower.startsWith('jenoptik')) return 'Jenoptik';
  if (lower.startsWith('uniview') || lower === 'unv') return 'Uniview';
  if (lower.startsWith('platelogiq')) return 'PlateLogiq';

  // Anything else not recognized → keep as-is (will land in "Other" if not top 3)
  return raw.trim();
};

/** True when a camera's raw brand tag matches any selected canonical label
 *  (direct raw match kept for the legacy dataset-derived fallback lists). */
export function brandMatchesSelection(
  rawBrand: string | undefined,
  selected: string[]
): boolean {
  if (!rawBrand) return false;
  if (selected.includes(rawBrand)) return true;
  const canonical = normalizeBrand(rawBrand);
  return canonical != null && selected.includes(canonical);
}

/** Operators aren't canonicalized client-side — match trimmed, case-insensitive. */
export function operatorMatchesSelection(
  rawOperator: string | undefined,
  selected: string[]
): boolean {
  if (!rawOperator) return false;
  const needle = rawOperator.trim().toLowerCase();
  return selected.some((s) => s.trim().toLowerCase() === needle);
}
