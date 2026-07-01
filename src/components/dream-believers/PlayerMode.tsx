import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaChevronLeft, FaVolumeHigh } from 'react-icons/fa6';
import { Box, Grid, HStack, Stack, Wrap } from 'styled-system/jsx';
import { css } from 'styled-system/css';
import { RecordDisc } from './RecordDisc';
import { useSyncedPlayer } from '~/hooks/useSyncedPlayer';
import { useLocalStorage } from '~/hooks/useLocalStorage';
import { bakedSections } from '~/utils/dream-believers/sections';
import { cutUrl, dbVersions, versionLabel, type Locale } from '~/utils/dream-believers/data';

type Tr = (k: string, v?: Record<string, string | number>) => string;

const ACCENT = '#e85a97';

// Standard-arrangement beat grid (161.5 BPM). Seeks snap to the nearest beat so
// jumps land tight instead of mid-phrase.
const BEAT = 60 / 161.5;
const BEAT_PHASE = 0.06;
// Game-size (short) edits align to the full timeline shifted by +2.032s.
const SHORT_TO_FULL_MS = 2032;
function snapBeat(p: number): number {
  return Math.max(0, BEAT_PHASE + Math.round((p - BEAT_PHASE) / BEAT) * BEAT);
}

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function PlayerMode({ locale, t, onExit }: { locale: Locale; t: Tr; onExit: () => void }) {
  const versions = useMemo(() => dbVersions.filter((v) => v.full ?? v.short), []);
  const tracks = useMemo(
    () =>
      versions.map((v) => {
        const c = v.full ?? v.short!;
        // A version with only the game-size cut (4-Member) is a radio edit of the
        // same recording: its first segment matches the full timeline shifted by
        // +2.032s. Place it there so it plays aligned; it auto-advances when the
        // edit runs out. Full cuts keep their own offset.
        const offsetMs = v.full ? c.offsetMs : c.offsetMs + SHORT_TO_FULL_MS;
        return { key: v.key, url: cutUrl(c), offsetMs, rate: c.rate };
      }),
    [versions]
  );
  const order = useMemo(() => tracks.map((tk) => tk.key), [tracks]);

  const [activeKey, setActiveKey] = useState('original');
  const { state, error, toggle, seek, switchTo, setVolume } = useSyncedPlayer(
    tracks,
    order,
    activeKey,
    'stream'
  );

  const [volume, setStoredVolume] = useLocalStorage<number>('db-volume', 0.8);
  const vol = volume ?? 0.8;
  useEffect(() => {
    setVolume(vol);
  }, [setVolume, vol, state.loadedKeys.length]);

  const activeVersion = versions.find((v) => v.key === state.activeKey) ?? versions[0];
  const activeColor = activeVersion?.member?.color ?? ACCENT;
  const duration = state.duration || 1;
  const available = useMemo(() => new Set(state.availableKeys), [state.availableKeys]);
  const loaded = useMemo(() => new Set(state.loadedKeys), [state.loadedKeys]);

  // Tracks decode on demand (bounded memory), so "ready" means the active track
  // is decoded — not all of them. A cold version decodes when picked.
  const ready = !error && loaded.size > 0;
  const activeReady = loaded.has(state.activeKey);

  const sections = useMemo(() => {
    const cluster = state.activeKey.startsWith('sakura') ? 'sakura:full' : 'standard:full';
    return bakedSections(cluster);
  }, [state.activeKey]);

  const onPick = useCallback(
    (key: string) => {
      setActiveKey(key);
      switchTo(key);
    },
    [switchTo]
  );

  // Player only: when the active track runs out (e.g. the shorter 4-Member cut
  // ends mid-timeline), roll onto the next still-playing version instead of going
  // silent. The reveal soundboard doesn't do this — it just disables the chip.
  useEffect(() => {
    if (!state.playing || !loaded.has(state.activeKey) || available.has(state.activeKey)) return;
    const next = order.find((k) => k !== state.activeKey && available.has(k));
    if (next) onPick(next);
  }, [state.playing, state.activeKey, available, loaded, order, onPick]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      seek(snapBeat(Math.min(Math.max(pct * duration, 0), duration)));
    },
    [seek, duration]
  );

  const posPct = Math.min(Math.max((state.position / duration) * 100, 0), 100);
  const activeUnavailable = activeReady && !available.has(state.activeKey);

  return (
    <Stack
      className="db-moment"
      key="player"
      gap={{ base: 4, sm: 5 }}
      alignItems="center"
      w="full"
      maxW="42rem"
      mx="auto"
      pb={{ base: 6, sm: 8 }}
    >
      <HStack
        zIndex="5"
        position="sticky"
        top="0"
        justifyContent="space-between"
        alignItems="center"
        w="full"
        py="2"
      >
        <button
          type="button"
          onClick={onExit}
          className={`db-glass ${css({
            cursor: 'pointer',
            display: 'flex',
            gap: '2',
            alignItems: 'center',
            borderRadius: 'full',
            py: '2',
            pl: '3',
            pr: '4',
            color: 'fg.default',
            fontSize: 'sm',
            fontWeight: '600',
            transition: 'transform 0.12s',
            _active: { transform: 'translateY(1px)' }
          })}`}
        >
          <FaChevronLeft size={13} /> {t('back')}
        </button>
        <Box
          color="accent.text"
          fontFamily="display"
          fontSize="sm"
          fontWeight="700"
          letterSpacing="0.06em"
          textTransform="uppercase"
        >
          {t('playerMode')}
        </Box>
        <Box w="92px" />
      </HStack>

      <Box className="db-float">
        <RecordDisc
          art={activeVersion?.jacket ?? null}
          playing={state.playing}
          progress={state.position / duration}
          onToggle={ready ? () => toggle() : undefined}
          spinIdle={false}
          playLabel={t('play')}
          pauseLabel={t('pause')}
          color={activeColor}
        />
      </Box>

      <Stack gap="1" alignItems="center" minH="3.4em" textAlign="center">
        <Box color="fg.default" fontFamily="display" fontSize="xl" fontWeight="800">
          {ready ? versionLabel(activeVersion, locale) : t('loadingAudio')}
        </Box>
        <Box h="1.2em" color={activeUnavailable ? '#d96b7a' : 'fg.subtle'} fontSize="xs">
          {error
            ? t('audioError')
            : !activeReady
              ? t('loadingAudio')
              : activeUnavailable
                ? t('versionUnavailableHere')
                : `${fmt(state.position)} / ${fmt(duration)}`}
        </Box>
      </Stack>

      {!ready ? (
        <Stack gap="3" alignItems="center" w="full" maxW="24rem" px={{ base: 2, sm: 0 }}>
          <Box className="db-shimmer" borderRadius="full" w="full" h="8px" bg="bg.muted" />
          <Box color="fg.subtle" fontSize="xs">
            {error ? t('audioError') : t('loadingAudio')}
          </Box>
        </Stack>
      ) : (
        <>
          <Stack gap="3" w="full" px={{ base: 2, sm: 0 }}>
            <Box
              className={ready ? undefined : 'db-shimmer'}
              role="slider"
              tabIndex={ready ? 0 : -1}
              aria-label={t('play')}
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(state.position)}
              onClick={ready ? handleSeek : undefined}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') seek(Math.min(state.position + 5, duration));
                else if (e.key === 'ArrowLeft') seek(Math.max(state.position - 5, 0));
              }}
              cursor={ready ? 'pointer' : 'default'}
              position="relative"
              borderRadius="full"
              w="full"
              h="8px"
              bg="bg.muted"
              overflow="hidden"
            >
              {ready && (
                <Box
                  style={{ width: `${posPct}%`, background: activeColor }}
                  position="absolute"
                  top="0"
                  left="0"
                  borderRadius="full"
                  h="full"
                />
              )}
            </Box>

            <HStack gap="3" justifyContent="center" alignItems="center">
              <Box display="flex" color="accent.text">
                <FaVolumeHigh size={14} />
              </Box>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={vol}
                onChange={(e) => setStoredVolume(Number(e.target.value))}
                aria-label={t('volume')}
                className={css({ cursor: 'pointer', w: '200px', accentColor: 'accent.default' })}
              />
            </HStack>
          </Stack>

          {sections.length > 0 && (
            <Wrap gap="2" justifyContent="center">
              {sections.map((sec) => (
                <button
                  key={`${sec.label}-${sec.t}`}
                  type="button"
                  disabled={!ready}
                  onClick={() => seek(snapBeat(sec.t))}
                  className={`db-glass ${css({
                    cursor: 'pointer',
                    borderRadius: 'full',
                    py: '1.5',
                    px: '3',
                    color: 'fg.default',
                    fontSize: 'xs',
                    fontWeight: '600',
                    transition: 'transform 0.12s, border-color 0.2s',
                    _disabled: { cursor: 'not-allowed', opacity: 0.5 },
                    _active: { transform: 'translateY(1px)' },
                    _hover: { color: 'accent.text' }
                  })}`}
                >
                  {t(`sections.${sec.label}`, { defaultValue: sec.label })}
                </button>
              ))}
            </Wrap>
          )}

          <Stack gap="2" w="full">
            <Grid gap="2" gridTemplateColumns={{ base: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }}>
              {versions.map((v, i) => {
                const active = v.key === state.activeKey;
                const isLoaded = loaded.has(v.key);
                const canPlayHere = available.has(v.key);
                // Cold tracks are tappable (they decode on pick); only a decoded
                // track that has no audio at the current playhead is disabled.
                const disabled = isLoaded && !canPlayHere;
                const decoding = v.key === state.pendingKey || (active && !isLoaded);
                const c = v.member?.color ?? ACCENT;
                return (
                  <button
                    key={v.key}
                    type="button"
                    aria-pressed={active}
                    disabled={disabled}
                    title={!canPlayHere && isLoaded ? t('versionUnavailableHere') : undefined}
                    onClick={() => onPick(v.key)}
                    className={`db-cascade ${decoding ? 'db-shimmer' : ''} ${css({
                      cursor: 'pointer',
                      display: 'flex',
                      position: 'relative',
                      gap: '2',
                      alignItems: 'center',
                      borderColor: active ? 'transparent' : 'border.default',
                      borderRadius: 'lg',
                      borderWidth: '1px',
                      minH: '48px',
                      py: '2',
                      pl: '3',
                      pr: '2.5',
                      color: active ? 'white' : 'fg.default',
                      fontSize: 'sm',
                      fontWeight: '600',
                      textAlign: 'left',
                      transition:
                        'transform 0.12s, background 0.2s, border-color 0.2s, opacity 0.2s',
                      _disabled: { cursor: 'not-allowed', opacity: 0.42 },
                      _active: { transform: 'translateY(1px)' },
                      _hover: { borderColor: active ? 'transparent' : 'accent.default' }
                    })}`}
                    style={{ animationDelay: `${i * 30}ms`, background: active ? c : undefined }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: '8px',
                        height: '8px',
                        borderRadius: '9999px',
                        background: active ? 'rgba(255,255,255,0.9)' : c
                      }}
                    />
                    <span style={{ flex: 1 }}>{versionLabel(v, locale)}</span>
                  </button>
                );
              })}
            </Grid>
          </Stack>
        </>
      )}
    </Stack>
  );
}
