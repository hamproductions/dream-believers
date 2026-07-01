import manifest from '../../data/manifest.json';
import { getAssetUrl } from '~/utils/assets';

export type SyncGroup = 'standard' | 'sakura';
export type CutName = 'short' | 'full';
export type Locale = 'ja' | 'en';

export interface Cut {
  audio: string;
  external: boolean;
  offsetMs: number;
}

export interface Version {
  key: string;
  label: { ja: string; en: string };
  kind: 'group' | 'solo';
  gen?: string;
  member?: { id: string; ja: string; en: string; color?: string };
  syncGroup: SyncGroup;
  jacket?: string | null;
  short: Cut | null;
  full: Cut | null;
}

const data = manifest as unknown as {
  song: { id: string; name: string; enName: string };
  syncGroups: Record<SyncGroup, { ja: string; en: string }>;
  versions: Version[];
};

export const dbSong = data.song;
export const dbSyncGroups = data.syncGroups;
export const dbVersions: Version[] = data.versions;

export function versionByKey(key: string): Version | undefined {
  return dbVersions.find((v) => v.key === key);
}

/** The audio a version plays in the game: full if it exists, else game-size. */
export function primaryCut(v: Version): { name: CutName; cut: Cut } {
  return v.full ? { name: 'full', cut: v.full } : { name: 'short', cut: v.short as Cut };
}

/** One pool: every version (each plays its own primary cut), optionally minus solos. */
export function unifiedPool(includeSolos: boolean): Version[] {
  return dbVersions.filter((v) => (v.full || v.short) && (includeSolos || v.kind !== 'solo'));
}

export function cutUrl(cut: Cut): string {
  return getAssetUrl(`assets/dream-believers/${cut.audio}.webm`);
}

export function jacketUrl(id: string): string {
  return getAssetUrl(`assets/jackets/${id}.webp`);
}

export function versionLabel(v: Version, locale: Locale): string {
  return v.label[locale] ?? v.label.ja;
}

export function getCut(v: Version, cut: CutName): Cut | null {
  return v[cut];
}

export function clusterFor(syncGroup: SyncGroup, cut: CutName): Version[] {
  return dbVersions.filter((v) => v.syncGroup === syncGroup && v[cut]);
}

export function overlayClusters(): { syncGroup: SyncGroup; cut: CutName; versions: Version[] }[] {
  const out: { syncGroup: SyncGroup; cut: CutName; versions: Version[] }[] = [];
  for (const syncGroup of Object.keys(data.syncGroups) as SyncGroup[]) {
    for (const cut of ['short', 'full'] as CutName[]) {
      const versions = clusterFor(syncGroup, cut);
      if (versions.length > 1) out.push({ syncGroup, cut, versions });
    }
  }
  return out;
}
