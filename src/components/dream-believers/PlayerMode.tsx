import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaChevronLeft, FaVolumeHigh } from 'react-icons/fa6';
import { Box, Grid, HStack, Stack, Wrap } from 'styled-system/jsx';
import { css } from 'styled-system/css';
import { RecordDisc } from './RecordDisc';
import { useSyncedPlayer } from '~/hooks/useSyncedPlayer';
import { bakedSections } from '~/utils/dream-believers/sections';
import { cutUrl, dbVersions, versionLabel, type Locale } from '~/utils/dream-believers/data';

type Tr = (k: string, v?: Record<string, string | number>) => string;

const ACCENT = '#e85a97';

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function groupOf(key: string): 'sakura' | 'cover' | 'standard' {
  if (key === 'aikatsu') return 'cover';
  if (key.startsWith('sakura')) return 'sakura';
  return 'standard';
}

const GROUP_ORDER: Array<'standard' | 'sakura' | 'cover'> = ['standard', 'sakura', 'cover'];

export function PlayerMode({ locale, t, onExit }: { locale: Locale; t: Tr; onExit: () => void }) {
  const fullVersions = useMemo(() => dbVersions.filter((v) => v.full), []);
  const tracks = useMemo(
    () =>
      fullVersions.map((v) => ({
        key: v.key,
        url: cutUrl(v.full!),
        offsetMs: v.full!.offsetMs
      })),
    [fullVersions]
  );
  const order = useMemo(() => tracks.map((tk) => tk.key), [tracks]);

  const [activeKey, setActiveKey] = useState('original');
  const { state, loading, error, toggle, seek, switchTo, setVolume } = useSyncedPlayer(
    tracks,
    order,
    activeKey
  );

  const activeVersion = fullVersions.find((v) => v.key === state.activeKey) ?? fullVersions[0];
  const activeColor = activeVersion?.member?.color ?? ACCENT;
  const duration = state.duration || 1;
  const available = useMemo(() => new Set(state.availableKeys), [state.availableKeys]);
  const loaded = useMemo(() => new Set(state.loadedKeys), [state.loadedKeys]);

  const sections = useMemo(() => {
    const cluster = groupOf(state.activeKey) === 'sakura' ? 'sakura:full' : 'standard:full';
    return bakedSections(cluster);
  }, [state.activeKey]);

  const groups = useMemo(() => {
    return GROUP_ORDER.map((g) => ({
      id: g,
      versions: fullVersions.filter((v) => groupOf(v.key) === g)
    })).filter((grp) => grp.versions.length > 0);
  }, [fullVersions]);

  const onPick = useCallback(
    (key: string) => {
      setActiveKey(key);
      switchTo(key);
    },
    [switchTo]
  );

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      seek(Math.min(Math.max(pct * duration, 0), duration));
    },
    [seek, duration]
  );

  useEffect(() => {
    setVolume(0.8);
  }, [setVolume]);

  const posPct = Math.min(Math.max((state.position / duration) * 100, 0), 100);
  const activeUnavailable = !loading && !available.has(state.activeKey);

  return (
    <Stack
      className="db-moment"
      key="player"
      gap={{ base: 5, sm: 6 }}
      alignItems="center"
      w="full"
      maxW="46rem"
      py={{ base: 4, sm: 6 }}
      px={4}
    >
      <HStack justifyContent="space-between" alignItems="center" w="full">
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
        <Box w={{ base: '0', sm: '92px' }} />
      </HStack>

      <Box className="db-float">
        <RecordDisc
          art={activeVersion?.jacket ?? null}
          playing={state.playing}
          progress={state.position / duration}
          onToggle={loading ? undefined : () => toggle()}
          spinIdle={false}
          playLabel={t('play')}
          pauseLabel={t('pause')}
          color={activeColor}
        />
      </Box>

      <Stack gap="1" alignItems="center" minH="3.4em" textAlign="center">
        <Box color="fg.default" fontFamily="display" fontSize="xl" fontWeight="800">
          {loading ? t('loadingAudio') : versionLabel(activeVersion, locale)}
        </Box>
        <Box h="1.2em" color={activeUnavailable ? '#d96b7a' : 'fg.subtle'} fontSize="xs">
          {error
            ? t('audioError')
            : activeUnavailable
              ? t('versionUnavailableHere')
              : loading
                ? `${loaded.size}/${tracks.length}`
                : `${t('nowPlayingVersion')} · ${fmt(state.position)} / ${fmt(duration)}`}
        </Box>
      </Stack>

      <Box
        className={loading ? 'db-shimmer' : undefined}
        role="slider"
        tabIndex={loading ? -1 : 0}
        aria-label={t('play')}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(state.position)}
        onClick={loading ? undefined : handleSeek}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') seek(Math.min(state.position + 5, duration));
          else if (e.key === 'ArrowLeft') seek(Math.max(state.position - 5, 0));
        }}
        cursor={loading ? 'default' : 'pointer'}
        position="relative"
        borderRadius="full"
        w="full"
        h="8px"
        bg="bg.muted"
        overflow="hidden"
      >
        {!loading && (
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

      {sections.length > 0 && (
        <Wrap gap="2" justifyContent="center">
          {sections.map((sec) => (
            <button
              key={`${sec.label}-${sec.t}`}
              type="button"
              disabled={loading}
              onClick={() => seek(sec.t)}
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

      <Stack gap="4" w="full">
        {groups.map((grp) => (
          <Stack key={grp.id} gap="2">
            <Box
              color="fg.subtle"
              fontFamily="mono"
              fontSize="2xs"
              letterSpacing="widest"
              textTransform="uppercase"
            >
              {t(`group.${grp.id}`)}
            </Box>
            <Grid gap="2" gridTemplateColumns={{ base: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }}>
              {grp.versions.map((v, i) => {
                const active = v.key === state.activeKey;
                const isLoaded = loaded.has(v.key);
                const canPlayHere = available.has(v.key);
                const disabled = loading || !isLoaded || !canPlayHere;
                const c = v.member?.color ?? ACCENT;
                return (
                  <button
                    key={v.key}
                    type="button"
                    aria-pressed={active}
                    disabled={disabled}
                    title={!canPlayHere && isLoaded ? t('versionUnavailableHere') : undefined}
                    onClick={() => onPick(v.key)}
                    className={`db-cascade ${!isLoaded && loading ? 'db-shimmer' : ''} ${css({
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
                    style={{
                      animationDelay: `${i * 30}ms`,
                      background: active ? c : undefined
                    }}
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
        ))}
      </Stack>

      <HStack className="db-glass" gap={2} borderRadius="full" py={2} px={3}>
        <Box display="flex" color="accent.text">
          <FaVolumeHigh size={14} />
        </Box>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.8}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label={t('volume')}
          className={css({ cursor: 'pointer', w: '140px', accentColor: 'accent.default' })}
        />
      </HStack>
    </Stack>
  );
}
