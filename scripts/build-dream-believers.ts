import { execFile } from 'child_process';
import { mkdir, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

const run = promisify(execFile);

const REPO = join(__dirname, '..');
const OUT_DIR = join(REPO, 'public/assets/dream-believers');
const MANIFEST = join(REPO, 'data/dream-believers.json');
const LLLL_MP3 = '/Users/vittayapalotai.tanyawat/code/llll/data/music/mp3';

interface Cut {
  audio: string;
  offsetMs?: number;
  rate?: number;
  src:
    | { kind: 'llll-mp3'; soundId: number }
    | { kind: 'local-file'; path: string }
    | { kind: 'wikia'; url: string }
    | { kind: 'sorter-webm' };
}

interface Version {
  key: string;
  label: { ja: string; en: string };
  kind: 'group' | 'solo';
  gen?: string;
  member?: { id: string; ja: string; en: string; color?: string };
  syncGroup: 'standard' | 'sakura';
  short?: Cut;
  full?: Cut;
}

const wikia = (path: string): Cut['src'] => ({
  kind: 'wikia',
  url: `https://static.wikia.nocookie.net/love-live/images/${path}`
});

const VERSIONS: Version[] = [
  {
    key: 'original',
    label: { ja: '103期 Ver.', en: '103rd Ver.' },
    kind: 'group',
    gen: '102・103期',
    syncGroup: 'standard',
    short: { audio: '103112', src: { kind: 'sorter-webm' } },
    full: {
      audio: 'db-full-original',
      src: wikia('0/04/01._Dream_Believers.ogg/revision/latest?cb=20230329042355')
    }
  },
  {
    key: '4nin',
    label: { ja: '4人 Ver.', en: '4-Member Ver.' },
    kind: 'group',
    gen: '102・103期',
    syncGroup: 'standard',
    short: { audio: '103101', src: { kind: 'sorter-webm' } }
  },
  {
    key: '104',
    label: { ja: '104期 Ver.', en: '104th Ver.' },
    kind: 'group',
    gen: '102〜104期',
    syncGroup: 'standard',
    short: { audio: '104101', src: { kind: 'sorter-webm' } },
    full: {
      audio: 'db-full-104',
      src: wikia('0/0e/01._Dream_Believers_%28104_Ver.%29.ogg/revision/latest?cb=20240416055436')
    }
  },
  {
    key: '105',
    label: { ja: '105期 Ver.', en: '105th Ver.' },
    kind: 'group',
    gen: '103〜105期',
    syncGroup: 'standard',
    short: { audio: '105101', src: { kind: 'sorter-webm' } },
    full: {
      audio: 'db-full-105',
      src: wikia('5/56/01._Dream_Believers_%28105th_Ver.%29.ogg/revision/latest?cb=20250428105004')
    }
  },
  {
    key: 'bgp',
    label: { ja: 'B.G.P. Ver.', en: 'B.G.P. Ver.' },
    kind: 'group',
    gen: '102〜105期',
    syncGroup: 'standard',
    short: { audio: '405141', src: { kind: 'llll-mp3', soundId: 40514101 } },
    full: {
      audio: 'db-full-bgp',
      src: wikia('4/42/03._Dream_Believers_%28B.G.P._Ver.%29.ogg/revision/latest?cb=20260603082040')
    }
  },
  {
    key: 'aikatsu',
    label: { ja: 'Aikatsu! カバー', en: 'Aikatsu! Cover' },
    kind: 'group',
    gen: 'コラボ',
    syncGroup: 'standard',
    full: {
      audio: 'db-full-aikatsu',
      // Cover runs ~2% faster than the standard arrangement; slow onto the shared timeline.
      offsetMs: 50,
      rate: 0.9804,
      src: wikia(
        'c/c5/Dream_Believers_%28Aikatsu%21_Cover%29.ogg/revision/latest?cb=20251228103758'
      )
    }
  },
  {
    key: 'sakura',
    label: { ja: 'SAKURA Ver.', en: 'SAKURA Ver.' },
    kind: 'group',
    gen: '102〜104期',
    syncGroup: 'standard',
    short: { audio: '104119', src: { kind: 'sorter-webm' } },
    full: {
      audio: 'db-full-sakura',
      src: wikia('5/56/06._Dream_Believers_%28SAKURA_Ver.%29.ogg/revision/latest?cb=20250520111214')
    }
  },
  {
    key: 'sakura-kaho',
    label: { ja: '花帆 ソロ Ver.', en: 'Kaho Solo Ver.' },
    kind: 'solo',
    member: { id: '59', ja: '日野下花帆', en: 'Kaho Hinoshita', color: '#f8b500' },
    syncGroup: 'standard',
    full: {
      audio: 'db-solo-kaho',
      src: {
        kind: 'local-file',
        path: '/Users/vittayapalotai.tanyawat/Downloads/Dream_Believers_(SAKURA_Ver.).mp3'
      }
    }
  },
  {
    key: 'sakura-sayaka',
    label: { ja: 'さやか ソロ Ver.', en: 'Sayaka Solo Ver.' },
    kind: 'solo',
    member: { id: '60', ja: '村野さやか', en: 'Sayaka Murano', color: '#5383c3' },
    syncGroup: 'standard',
    full: {
      audio: 'db-solo-sayaka',
      src: {
        kind: 'local-file',
        path: '/Users/vittayapalotai.tanyawat/Downloads/Dream_Believers_(SAKURA_Ver.)-1.mp3'
      }
    }
  },
  {
    key: 'sakura-kozue',
    label: { ja: '梢 ソロ Ver.', en: 'Kozue Solo Ver.' },
    kind: 'solo',
    member: { id: '61', ja: '乙宗 梢', en: 'Kozue Otomune', color: '#68be8d' },
    syncGroup: 'standard',
    full: {
      audio: 'db-solo-kozue',
      src: wikia(
        '9/9e/Dream_Believers_%28SAKURA_Ver.%29_%28Kozue%29.ogg/revision/latest?cb=20250607021602'
      )
    }
  },
  {
    key: 'sakura-tsuzuri',
    label: { ja: '綴理 ソロ Ver.', en: 'Tsuzuri Solo Ver.' },
    kind: 'solo',
    member: { id: '62', ja: '夕霧綴理', en: 'Tsuzuri Yugiri', color: '#ba2636' },
    syncGroup: 'standard',
    full: {
      audio: 'db-solo-tsuzuri',
      src: wikia(
        'c/cc/Dream_Believers_%28SAKURA_Ver.%29_%28Tsuzuri%29.ogg/revision/latest?cb=20250607022610'
      )
    }
  },
  {
    key: 'sakura-rurino',
    label: { ja: '瑠璃乃 ソロ Ver.', en: 'Rurino Solo Ver.' },
    kind: 'solo',
    member: { id: '63', ja: '大沢瑠璃乃', en: 'Rurino Osawa', color: '#e7609e' },
    syncGroup: 'standard',
    full: {
      audio: 'db-solo-rurino',
      src: {
        kind: 'local-file',
        path: '/Users/vittayapalotai.tanyawat/Downloads/Dream_Believers_(SAKURA_Ver.)-2.mp3'
      }
    }
  },
  {
    key: 'sakura-megumi',
    label: { ja: '慈 ソロ Ver.', en: 'Megumi Solo Ver.' },
    kind: 'solo',
    member: { id: '64', ja: '藤島 慈', en: 'Megumi Fujishima', color: '#c8c2c6' },
    syncGroup: 'standard',
    full: {
      audio: 'db-solo-megumi',
      src: wikia(
        '7/7b/Dream_Believers_%28SAKURA_Ver.%29_%28Megumi%29.ogg/revision/latest?cb=20250603123136'
      )
    }
  }
];

const exists = async (p: string) =>
  access(p)
    .then(() => true)
    .catch(() => false);

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
}

async function toWebm(input: string, output: string) {
  await run('ffmpeg', ['-y', '-i', input, '-c:a', 'libopus', '-b:a', '128k', '-vn', output]);
}

async function buildCut(cut: Cut) {
  if (cut.src.kind === 'sorter-webm') return; // already in assets/songs/audio
  const out = join(OUT_DIR, `${cut.audio}.webm`);
  if (await exists(out)) {
    console.log(`  skip ${cut.audio}.webm (exists)`);
    return;
  }
  const tmp = join(OUT_DIR, `.tmp-${cut.audio}`);
  if (cut.src.kind === 'llll-mp3') {
    const mp3 = join(LLLL_MP3, `bgm_live_${cut.src.soundId}.mp3`);
    await toWebm(mp3, out);
  } else if (cut.src.kind === 'local-file') {
    await toWebm(cut.src.path, out);
  } else {
    const ogg = `${tmp}.ogg`;
    await download(cut.src.url, ogg);
    await toWebm(ogg, out);
    await run('rm', ['-f', ogg]);
  }
  console.log(`  built ${cut.audio}.webm`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const v of VERSIONS) {
    console.log(v.key);
    if (v.short) await buildCut(v.short);
    if (v.full) await buildCut(v.full);
  }

  // Jacket art lives in public/assets/jackets/<id>.webp.
  const JACKETS: Record<string, string | null> = {
    original: 'original',
    '4nin': '103101',
    '104': '104',
    '105': '105',
    bgp: 'bgp',
    aikatsu: 'aikatsu',
    sakura: 'sakura',
    'sakura-kaho': 'sakura-kaho',
    'sakura-sayaka': 'sakura-sayaka',
    'sakura-kozue': 'sakura-kozue',
    'sakura-tsuzuri': 'sakura-tsuzuri',
    'sakura-rurino': 'sakura-rurino',
    'sakura-megumi': 'sakura-megumi'
  };

  const manifest = {
    song: { id: '502', name: 'Dream Believers', enName: 'Dream Believers' },
    syncGroups: {
      standard: { ja: '通常アレンジ', en: 'Standard arrangement' },
      sakura: { ja: 'SAKURA（バラード）', en: 'SAKURA (ballad)' }
    },
    versions: VERSIONS.map((v) => ({
      key: v.key,
      label: v.label,
      kind: v.kind,
      gen: v.gen,
      member: v.member,
      syncGroup: v.syncGroup,
      jacket: JACKETS[v.key] ?? null,
      short: v.short
        ? { audio: v.short.audio, external: v.short.src.kind !== 'sorter-webm' }
        : null,
      full: v.full ? { audio: v.full.audio, external: true } : null,
      offsetMs: 0
    }))
  };
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nmanifest -> ${MANIFEST}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
