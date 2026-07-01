import { useCallback } from 'react';
import { FaPause, FaPlay } from 'react-icons/fa6';
import { Box, Grid, HStack, Stack } from 'styled-system/jsx';
import { css } from 'styled-system/css';
import type { CutName, Locale, Version } from '~/utils/dream-believers/data';
import { getCut, versionLabel } from '~/utils/dream-believers/data';
import type { SyncedPlayerState } from '~/utils/dream-believers/SyncedVersionPlayer';

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface Props {
  versions: Version[];
  cut: CutName;
  locale: Locale;
  t: (k: string, v?: Record<string, string | number>) => string;
  state: SyncedPlayerState;
  loading: boolean;
  error: boolean;
  toggle: (pos?: number) => void;
  seek: (pos: number) => void;
  switchTo: (key: string) => void;
  offsets: Record<string, number>;
  onOffset: (key: string, ms: number) => void;
  allowSwitch: boolean;
  showOffset?: boolean;
  clipStart?: number;
  clipEnd?: number | null;
}

export function SyncedPlayerPanel({
  versions,
  cut,
  locale,
  t,
  state,
  loading,
  error,
  toggle,
  seek,
  switchTo,
  offsets,
  onOffset,
  allowSwitch,
  showOffset = false,
  clipStart = 0,
  clipEnd = null
}: Props) {
  const duration = state.duration || 1;
  const lower = clipStart;
  const upper = clipEnd ?? duration;

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      seek(Math.min(Math.max(lower + pct * (upper - lower), lower), upper));
    },
    [seek, lower, upper]
  );

  if (error) {
    return (
      <Stack alignItems="center" p="4">
        <Box color="#d96b7a">{t('audioError')}</Box>
      </Stack>
    );
  }

  const posPct = ((state.position - lower) / (upper - lower)) * 100;
  const activeVersion = versions.find((v) => v.key === state.activeKey);
  const activeCut = activeVersion ? getCut(activeVersion, cut) : null;
  const activeOffset = activeVersion ? (offsets[activeVersion.key] ?? activeCut?.offsetMs ?? 0) : 0;

  return (
    <Stack gap="4" w="full">
      <HStack gap="4" alignItems="center">
        <button
          type="button"
          disabled={loading}
          onClick={() => toggle()}
          aria-label={state.playing ? t('pause') : t('play')}
          className={css({
            cursor: 'pointer',
            display: 'flex',
            flexShrink: 0,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 'full',
            w: '56px',
            h: '56px',
            color: 'white',
            fontSize: 'lg',
            bg: 'accent.default',
            transition: 'transform 0.12s, background 0.2s',
            _disabled: { cursor: 'not-allowed', opacity: 0.5 },
            _active: { transform: 'translateY(1px) scale(0.97)' },
            _hover: { bg: 'accent.emphasized' }
          })}
        >
          {state.playing ? <FaPause /> : <FaPlay style={{ marginLeft: 2 }} />}
        </button>

        <Stack flex="1" gap="1.5">
          <Box
            className={loading ? 'db-shimmer' : undefined}
            role="slider"
            tabIndex={loading ? -1 : 0}
            aria-label={t('play')}
            aria-valuemin={0}
            aria-valuemax={Math.round(upper - lower)}
            aria-valuenow={Math.round(state.position - lower)}
            onClick={handleSeek}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') seek(Math.min(state.position + 2, upper));
              else if (e.key === 'ArrowLeft') seek(Math.max(state.position - 2, lower));
            }}
            cursor="pointer"
            position="relative"
            borderRadius="full"
            w="full"
            h="8px"
            bg="bg.muted"
            overflow="hidden"
          >
            {!loading && (
              <Box
                style={{ width: `${Math.min(Math.max(posPct, 0), 100)}%` }}
                position="absolute"
                top="0"
                left="0"
                borderRadius="full"
                h="full"
                bg="accent.default"
              />
            )}
          </Box>
          <HStack justifyContent="space-between">
            <Box color="fg.subtle" fontFamily="mono" fontSize="xs">
              {loading
                ? t('loadingAudio')
                : allowSwitch && activeVersion
                  ? versionLabel(activeVersion, locale)
                  : '? ? ?'}
            </Box>
            <Box color="fg.muted" fontFamily="mono" fontSize="xs">
              {fmt(Math.min(Math.max(state.position - lower, 0), upper - lower))} /{' '}
              {fmt(Math.max(upper - lower, 0))}
            </Box>
          </HStack>
        </Stack>
      </HStack>

      {allowSwitch && (
        <Stack gap="2">
          <Box
            color="fg.subtle"
            fontFamily="mono"
            fontSize="2xs"
            letterSpacing="widest"
            textTransform="uppercase"
          >
            {t('switchVersion')}
          </Box>
          <Grid gap="2" gridTemplateColumns={{ base: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }}>
            {versions.map((v, i) => {
              const active = v.key === state.activeKey;
              return (
                <button
                  key={v.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => switchTo(v.key)}
                  className={`db-cascade ${css({
                    cursor: 'pointer',
                    borderColor: active ? 'accent.default' : 'border.default',
                    borderRadius: 'lg',
                    borderWidth: '1px',
                    py: '2',
                    px: '3',
                    color: active ? 'white' : 'fg.default',
                    fontSize: 'sm',
                    fontWeight: '500',
                    bg: active ? 'accent.default' : 'transparent',
                    transition: 'transform 0.12s, background 0.2s, border-color 0.2s',
                    _active: { transform: 'translateY(1px)' },
                    _hover: { borderColor: 'accent.default' }
                  })}`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {versionLabel(v, locale)}
                </button>
              );
            })}
          </Grid>
        </Stack>
      )}

      {allowSwitch && showOffset && activeVersion && (
        <HStack gap="3" justifyContent="center" alignItems="center" pt="1">
          <Box color="fg.subtle" fontFamily="mono" fontSize="2xs">
            {t('offset')}
          </Box>
          <OffsetButton onClick={() => onOffset(activeVersion.key, -10)}>−10</OffsetButton>
          <Box minW="56px" color="fg.muted" fontFamily="mono" fontSize="xs" textAlign="center">
            {activeOffset.toFixed(0)}ms
          </Box>
          <OffsetButton onClick={() => onOffset(activeVersion.key, 10)}>+10</OffsetButton>
        </HStack>
      )}
    </Stack>
  );
}

function OffsetButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={css({
        cursor: 'pointer',
        borderColor: 'border.default',
        borderRadius: 'md',
        borderWidth: '1px',
        minH: '44px',
        py: '2.5',
        px: '3',
        color: 'fg.muted',
        fontFamily: 'mono',
        fontSize: 'xs',
        transition: 'all 0.15s',
        _active: { transform: 'translateY(1px)' },
        _hover: { borderColor: 'accent.default', color: 'fg.default' }
      })}
    >
      {children}
    </button>
  );
}
