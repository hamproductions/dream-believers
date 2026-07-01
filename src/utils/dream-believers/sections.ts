import bakedData from '../../data/sections.json';

export interface Section {
  t: number; // start time in seconds
  label: string;
}

const baked = bakedData as Record<
  string,
  { offsets?: Record<string, number>; sections: Section[] }
>;

/** Curated sections for a cluster (user-tuned, source of truth), or [] if none. */
export function bakedSections(clusterId: string): Section[] {
  return baked[clusterId]?.sections ?? [];
}

// Canonical J-idol song structure, in order. Editable in the tuner.
export const SECTION_LABELS = [
  'イントロ',
  'Aメロ',
  'Bメロ',
  'サビ',
  '間奏',
  'Aメロ2',
  'Bメロ2',
  'サビ2',
  'Cメロ',
  '落ちサビ',
  '大サビ',
  'アウトロ'
] as const;

const TEMPLATE_FRACTIONS = [0, 0.09, 0.2, 0.28, 0.4, 0.46, 0.56, 0.63, 0.74, 0.82, 0.88, 0.96];

export function seedSections(duration: number, chorusStart?: number): Section[] {
  const secs = TEMPLATE_FRACTIONS.map((f, i) => ({
    t: +(f * duration).toFixed(2),
    label: SECTION_LABELS[i]
  }));
  // Snap the first サビ to the detected chorus, if we have one.
  if (chorusStart && chorusStart > 0 && chorusStart < duration) {
    const sabi = secs.find((s) => s.label === 'サビ');
    if (sabi) sabi.t = +chorusStart.toFixed(2);
  }
  return secs.toSorted((a, b) => a.t - b.t);
}

const KEY = 'db-sections';

export function loadSections(): Record<string, Section[]> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function saveSections(all: Record<string, Section[]>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
