import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaPlay, FaShareNodes, FaVolumeHigh, FaXmark } from 'react-icons/fa6';
import { Box, Grid, HStack, Stack } from 'styled-system/jsx';
import { css } from 'styled-system/css';
import { Metadata } from '~/components/layout/Metadata';
import { PlayerMode } from '~/components/dream-believers/PlayerMode';
import { RecordDisc } from '~/components/dream-believers/RecordDisc';
import { useToaster } from '~/context/ToasterContext';
import { useDreamBelieversGame } from '~/hooks/useDreamBelieversGame';
import { useSyncedPlayer } from '~/hooks/useSyncedPlayer';
import type { SyncedTrack } from '~/utils/dream-believers/SyncedVersionPlayer';
import {
  cutUrl,
  dbSong,
  getCut,
  jacketUrl,
  versionLabel,
  type Locale
} from '~/utils/dream-believers/data';
import { getPicUrl } from '~/utils/assets';

const GOLD = '#f8b500';
const WILT = '#b58aa6';

function Wordmark() {
  return (
    <Box
      style={{ textShadow: '0 2px 20px rgba(255,158,205,0.5)' }}
      color="fg.default"
      fontFamily="script"
      fontSize={{ base: '6xl', sm: '7xl' }}
      lineHeight="0.9"
    >
      Dream Believers
    </Box>
  );
}

function PetalMeter({
  max,
  guesses,
  targetKey,
  attempt
}: {
  max: number;
  guesses: string[];
  targetKey: string;
  attempt: number;
}) {
  return (
    <HStack gap={2} alignItems="center">
      <HStack gap={1.5}>
        {Array.from({ length: max }).map((_, i) => {
          const g = guesses[i];
          const filled = g !== undefined;
          const correct = g === targetKey && g !== '';
          const current = i === attempt && !filled;
          let background = 'rgba(232,90,151,0.22)';
          let opacity = 1;
          let transform = 'none';
          if (correct) {
            background = GOLD;
          } else if (filled && g === '') {
            background = '#c9b8d6';
            opacity = 0.5;
          } else if (filled) {
            background = WILT;
            opacity = 0.55;
            transform = 'rotate(40deg) scale(0.82)';
          } else if (current) {
            background = '#ff8fbf';
          }
          return (
            <span
              key={i}
              className={`db-meter-petal ${filled ? 'db-pop' : ''}`}
              style={{ background, opacity, transform }}
            />
          );
        })}
      </HStack>
      <Box style={{ minWidth: '2.4em' }} color="fg.subtle" fontSize="sm" fontWeight="600">
        {guesses.length}/{max}
      </Box>
    </HStack>
  );
}

function WinBurst({ color }: { color: string }) {
  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      h="240px"
      overflow="visible"
      pointerEvents="none"
    >
      {Array.from({ length: 22 }).map((_, i) => {
        const angle = (i / 22) * Math.PI * 2;
        const dist = 96 + (i % 3) * 30;
        const bx = Math.cos(angle) * dist;
        const by = Math.sin(angle) * dist - 20;
        const c = i % 2 === 0 ? color : '#ff9ec6';
        return (
          <span
            key={i}
            className="db-burst-petal"
            style={{
              background: c,
              animationDelay: `${(i % 5) * 40}ms`,
              ['--bx' as string]: `${bx}px`,
              ['--by' as string]: `${by}px`
            }}
          />
        );
      })}
    </Box>
  );
}

const chip = css({
  cursor: 'pointer',
  display: 'flex',
  position: 'relative',
  gap: '2.5',
  alignItems: 'center',
  borderRadius: 'xl',
  minH: '52px',
  py: '3',
  pl: '3',
  pr: '3',
  color: 'fg.default',
  fontSize: 'sm',
  fontWeight: '600',
  textAlign: 'left',
  wordBreak: 'keep-all',
  overflow: 'hidden',
  transition: 'transform 0.12s, box-shadow 0.2s',
  _active: { transform: 'translateY(0)' },
  _hover: { transform: 'translateY(-2px)' }
});

const chipUsed = css({
  cursor: 'not-allowed',
  color: 'fg.muted',
  textDecoration: 'line-through',
  textDecorationColor: 'rgba(224,60,90,0.8)',
  background: 'rgba(224,60,90,0.14)',
  opacity: 0.72,
  boxShadow: 'inset 0 0 0 1.5px rgba(224,60,90,0.55)',
  _hover: { transform: 'none' }
});

const primaryBtn = css({
  cursor: 'pointer',
  borderRadius: 'full',
  py: '3.5',
  px: '8',
  color: 'white',
  fontSize: 'md',
  fontWeight: '700',
  transition: 'transform 0.12s, box-shadow 0.2s',
  _active: { transform: 'translateY(1px)' }
});

const ghostBtn = css({
  cursor: 'pointer',
  display: 'flex',
  gap: '2',
  alignItems: 'center',
  borderColor: 'border.default',
  borderRadius: 'full',
  borderWidth: '1px',
  py: '3.5',
  px: '5',
  color: 'fg.default',
  fontWeight: '600',
  transition: 'all 0.2s',
  _active: { transform: 'translateY(1px)' },
  _hover: { borderColor: 'accent.default' }
});

export default function Page() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === 'ja' ? 'ja' : 'en';
  const tp = useCallback(
    (k: string, v?: Record<string, string | number>) => t(`dreamBelievers.${k}`, v),
    [t]
  );
  const { toast } = useToaster();

  const game = useDreamBelieversGame();
  const { includeSolos, setIncludeSolos, mode, setMode, activeVersions, activeCut, round, quit } =
    game;

  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const [wrongKey, setWrongKey] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState(0);
  const [showPlayer, setShowPlayer] = useState(false);

  const done = round?.status === 'won' || round?.status === 'lost';
  const targetVersion = round ? activeVersions.find((v) => v.key === round.targetKey) : undefined;
  const revealColor = targetVersion?.member?.color ?? '#e85a97';

  const revealVersions = useMemo(
    () => activeVersions.filter((v) => getCut(v, activeCut)),
    [activeVersions, activeCut]
  );
  const panelVersions = useMemo(
    () => (done ? revealVersions : targetVersion ? [targetVersion] : []),
    [done, revealVersions, targetVersion]
  );
  const panelCut = activeCut;

  const compareStart = done && round ? round.startPosition : 0;
  const compareEnd = done && round ? round.startPosition + game.revealDuration : null;

  const tracks = useMemo<SyncedTrack[]>(() => {
    return panelVersions
      .map((v): SyncedTrack | null => {
        const c = getCut(v, panelCut);
        return c
          ? { key: v.key, url: cutUrl(c), offsetMs: offsets[v.key] ?? c.offsetMs, rate: c.rate }
          : null;
      })
      .filter((x): x is SyncedTrack => x != null);
  }, [panelVersions, panelCut, offsets]);
  const order = useMemo(() => tracks.map((t) => t.key), [tracks]);

  const initialActive = round?.targetKey ?? order[0] ?? '';
  const player = useSyncedPlayer(tracks, order, initialActive);
  const { state, loading, error, toggle, seek, switchTo, setClip, pause, play, setVolume } = player;

  // Player mode and an active round are in-page states, not routes. Wire both to
  // browser history + Escape so the back button, browser/hardware back, and Esc
  // all return home the same way instead of trapping the user or leaving the site.
  const away = showPlayer || !!round;
  const goHome = useCallback(() => {
    pause();
    setShowPlayer(false);
    quit();
  }, [pause, quit]);
  useEffect(() => {
    if (!away) return;
    window.history.pushState({ dbAway: true }, '');
    const onPop = () => goHome();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.history.back();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
    };
  }, [away, goHome]);

  const playPendingRef = useRef(false);

  const roundKey = round
    ? `${round.targetCut}:${round.targetKey}:${round.startPosition}:${done}`
    : '';
  const targetLoaded = !!round && state.loadedKeys.includes(round.targetKey);

  const lastRoundKey = useRef('');
  useEffect(() => {
    if (!round || loading || !targetLoaded) return;
    const armed = lastRoundKey.current !== roundKey;
    if (armed) {
      lastRoundKey.current = roundKey;
      if (done) {
        pause();
        return;
      }
      switchTo(round.targetKey);
      seek(round.startPosition);
    }
    if (!done) {
      setClip(round.startPosition, round.startPosition + game.revealDuration);
      if (playPendingRef.current) {
        playPendingRef.current = false;
        void play(round.startPosition);
      }
    }
  }, [
    round,
    roundKey,
    game.revealDuration,
    done,
    loading,
    targetLoaded,
    pause,
    switchTo,
    seek,
    setClip,
    play
  ]);

  useEffect(() => {
    if (!done || !targetLoaded || compareEnd == null) return;
    setClip(compareStart, compareEnd);
    seek(compareStart);
  }, [done, targetLoaded, compareStart, compareEnd, setClip, seek]);

  const startRound = useCallback(
    (daily: boolean) => {
      pause();
      setOffsets({});
      setWrongKey(null);
      playPendingRef.current = true;
      game.newRound(daily);
    },
    [game, pause]
  );

  const handleGuess = useCallback(
    (key: string) => {
      if (!round || round.status !== 'playing') return;
      const right = key === round.targetKey;
      if (!right) {
        setWrongKey(key);
        setShakeId((n) => n + 1);
        toast({ title: t('dreamBelievers.wrongToast') });
        window.setTimeout(() => setWrongKey((k) => (k === key ? null : k)), 650);
        playPendingRef.current = true;
      }
      game.guess(key);
    },
    [round, game, toast, t]
  );

  const playSound = useCallback(
    (key: string) => {
      if (compareEnd == null) return;
      pause();
      setClip(compareStart, compareEnd);
      switchTo(key);
      seek(compareStart);
      void play(compareStart);
    },
    [compareStart, compareEnd, pause, play, seek, setClip, switchTo]
  );

  const share = useCallback(() => {
    if (!round) return;
    const solved = round.status === 'won';
    const n = solved ? round.attempt + 1 : 'X';
    const squares = Array.from({ length: game.maxAttempts })
      .map((_, i) => {
        const g = round.guesses[i];
        if (g === undefined) return '⬜';
        if (g === round.targetKey && g !== '') return '🟩';
        return g === '' ? '⏭️' : '🟥';
      })
      .join('');
    const answer = solved && targetVersion ? `\n▶ ${versionLabel(targetVersion, locale)}` : '';
    const head = t('dreamBelievers.shareText', { n, max: game.maxAttempts });
    const text = `${head}${answer}\n${squares}`;
    void navigator.clipboard
      .writeText(text)
      .then(() => toast({ title: t('dreamBelievers.copied') }));
  }, [round, game.maxAttempts, targetVersion, locale, toast, t]);

  const winRate = game.stats.played ? Math.round((game.stats.won / game.stats.played) * 100) : 0;

  const clipProgress =
    round && !done
      ? Math.max(
          0,
          Math.min(1, (state.position - round.startPosition) / Math.max(0.1, game.revealDuration))
        )
      : 0;

  const volumeControl = (
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
        aria-label={t('dreamBelievers.volume')}
        className={css({ cursor: 'pointer', w: '110px', accentColor: 'accent.default' })}
      />
    </HStack>
  );

  const homeButton = (
    <HStack justifyContent="flex-start" w="full">
      <button
        type="button"
        onClick={() => window.history.back()}
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
        <FaChevronLeft size={13} /> {t('dreamBelievers.back')}
      </button>
    </HStack>
  );

  return (
    <Stack gap={{ base: 6, sm: 7 }} alignItems="center" w="full" py={{ base: 4, sm: 6 }} px={4}>
      <Metadata title={t('dreamBelievers.metaTitle')} />

      <Box
        role="status"
        aria-live="polite"
        style={{ clip: 'rect(0 0 0 0)' }}
        position="absolute"
        w="1px"
        h="1px"
        overflow="hidden"
        whiteSpace="nowrap"
      >
        {done && targetVersion
          ? `${round.status === 'won' ? t('dreamBelievers.correct') : t('dreamBelievers.reveal')} ${versionLabel(targetVersion, locale)}`
          : ''}
      </Box>

      {showPlayer && <PlayerMode locale={locale} t={tp} onExit={() => window.history.back()} />}

      {!round && !showPlayer && (
        <Stack
          className="db-moment"
          key="home"
          gap={{ base: 6, sm: 8 }}
          alignItems="center"
          pt={{ base: 2, sm: 4 }}
        >
          <Stack gap={1} alignItems="center" textAlign="center">
            <Wordmark />
            <Box
              color="accent.text"
              fontFamily="display"
              fontSize="lg"
              fontWeight="700"
              letterSpacing="0.04em"
            >
              {t('dreamBelievers.title')}
            </Box>
          </Stack>

          <Box className="db-float">
            <RecordDisc art="original" playing={false} spinIdle color="#ff9ec6" />
          </Box>

          <Box
            className="db-legible"
            maxW="30rem"
            color="fg.muted"
            fontSize="sm"
            lineHeight="1.6"
            textAlign="center"
          >
            {t('dreamBelievers.subtitle', { song: dbSong.name })}
          </Box>

          <HStack gap={3}>
            <button
              type="button"
              onClick={() => startRound(false)}
              className={primaryBtn}
              style={{
                background: 'linear-gradient(135deg,#ff8fbf,#e85a97)',
                boxShadow: '0 16px 40px -12px rgba(232,90,151,0.7)'
              }}
            >
              {t('dreamBelievers.playEndless')}
            </button>
            <button type="button" onClick={() => startRound(true)} className={ghostBtn}>
              {t('dreamBelievers.playDaily')}
            </button>
            <button
              type="button"
              onClick={() => {
                pause();
                setOffsets({});
                setShowPlayer(true);
              }}
              className={ghostBtn}
            >
              {t('dreamBelievers.playerMode')}
            </button>
          </HStack>

          <HStack
            className="db-glass"
            gap={3}
            justifyContent="center"
            borderRadius="2xl"
            py={3}
            px={5}
            flexWrap="wrap"
          >
            <HStack gap={1.5}>
              {(['normal', 'hard'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={css({
                    cursor: 'pointer',
                    borderRadius: 'full',
                    minH: '36px',
                    py: '1.5',
                    px: '3.5',
                    color: mode === m ? 'white' : 'fg.default',
                    fontSize: 'xs',
                    fontWeight: '800',
                    letterSpacing: 'widest',
                    textTransform: 'uppercase',
                    bg: mode === m ? 'accent.default' : 'transparent',
                    transition: 'background 0.2s, transform 0.12s',
                    _active: { transform: 'translateY(1px)' }
                  })}
                >
                  {t(`dreamBelievers.mode.${m}`)}
                </button>
              ))}
            </HStack>
            <Box display={{ base: 'none', sm: 'block' }} w="1px" h="20px" bg="border.default" />
            <HStack gap={2}>
              <Box color="fg.muted" fontSize="sm">
                {t('dreamBelievers.includeSolos')}
              </Box>
              <button
                type="button"
                role="switch"
                aria-checked={includeSolos}
                aria-label={t('dreamBelievers.includeSolos')}
                onClick={() => setIncludeSolos(!includeSolos)}
                className={css({
                  cursor: 'pointer',
                  position: 'relative',
                  borderRadius: 'full',
                  w: '44px',
                  h: '24px',
                  bg: includeSolos ? 'accent.default' : 'bg.emphasized',
                  transition: 'background 0.2s'
                })}
              >
                <Box
                  style={{ left: includeSolos ? '23px' : '3px' }}
                  position="absolute"
                  top="2px"
                  borderRadius="full"
                  w="18px"
                  h="18px"
                  bg="white"
                  transition="left 0.2s"
                />
              </button>
            </HStack>
            <Box display={{ base: 'none', sm: 'block' }} w="1px" h="20px" bg="border.default" />
            {volumeControl}
          </HStack>

          <HStack gap={8} pt={1}>
            {[
              { label: t('dreamBelievers.stats.played'), value: String(game.stats.played) },
              { label: t('dreamBelievers.stats.winRate'), value: `${winRate}%` },
              { label: t('dreamBelievers.stats.streak'), value: String(game.stats.streak) }
            ].map((s) => (
              <Stack key={s.label} gap={0.5} alignItems="center">
                <Box color="fg.default" fontFamily="display" fontSize="2xl" fontWeight="700">
                  {s.value}
                </Box>
                <Box
                  color="fg.subtle"
                  fontSize="2xs"
                  letterSpacing="wider"
                  textTransform="uppercase"
                >
                  {s.label}
                </Box>
              </Stack>
            ))}
          </HStack>
        </Stack>
      )}

      {round && !done && (
        <Stack
          className="db-moment"
          key="play"
          gap={{ base: 5, sm: 6 }}
          alignItems="center"
          w="full"
          maxW="40rem"
        >
          {homeButton}
          <PetalMeter
            max={game.maxAttempts}
            guesses={round.guesses}
            targetKey={round.targetKey}
            attempt={round.attempt}
          />

          <Box
            className="db-glass"
            borderRadius="full"
            py="1.5"
            px="4"
            color="accent.text"
            fontSize="sm"
            fontWeight="600"
          >
            ♪ {t('dreamBelievers.nowPlaying')}
          </Box>

          <div key={shakeId} className={shakeId ? 'db-shake' : undefined}>
            <RecordDisc
              mystery
              playing={state.playing}
              progress={clipProgress}
              onToggle={() => toggle(round.startPosition)}
              playLabel={t('dreamBelievers.play')}
              pauseLabel={t('dreamBelievers.pause')}
              color="#ff9ec6"
            />
          </div>
          <Box h="1.2em" color="fg.subtle" fontSize="xs">
            {loading
              ? t('dreamBelievers.loadingAudio')
              : error
                ? t('dreamBelievers.audioError')
                : ''}
          </Box>

          <Box
            className="db-legible"
            color="fg.muted"
            fontSize="xs"
            letterSpacing="widest"
            textTransform="uppercase"
          >
            {t('dreamBelievers.whichVersion')}
          </Box>

          <Grid gap={2.5} gridTemplateColumns="repeat(2, 1fr)" w="full">
            {activeVersions.map((v, i) => {
              const used = round.guesses.includes(v.key);
              const c = v.member?.color ?? '#e85a97';
              return (
                <button
                  key={v.key}
                  type="button"
                  disabled={used}
                  aria-disabled={used}
                  aria-label={
                    used
                      ? `${versionLabel(v, locale)} — ${t('dreamBelievers.wrongToast')}`
                      : versionLabel(v, locale)
                  }
                  onClick={() => handleGuess(v.key)}
                  className={`db-glass ${chip} ${used ? chipUsed : ''} ${
                    wrongKey === v.key ? 'db-wrong-flash' : 'db-cascade'
                  }`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '5px',
                      background: used ? 'rgba(224,60,90,0.85)' : c
                    }}
                  />
                  <span style={{ flex: 1 }}>{versionLabel(v, locale)}</span>
                  {used && (
                    <FaXmark size={15} style={{ flexShrink: 0 }} color="rgba(224,60,90,0.95)" />
                  )}
                </button>
              );
            })}
          </Grid>

          <HStack gap={4} pt={1}>
            <button
              type="button"
              onClick={game.skip}
              className={`db-glass ${css({
                cursor: 'pointer',
                borderRadius: 'full',
                py: '1.5',
                px: '4',
                color: 'fg.default',
                fontSize: 'sm',
                fontWeight: '600',
                transition: 'transform 0.12s',
                _active: { transform: 'translateY(1px)' }
              })}`}
            >
              {t('dreamBelievers.skip')} (+{Math.max(0, game.maxAttempts - round.attempt - 1)})
            </button>
            {volumeControl}
          </HStack>
        </Stack>
      )}

      {round && done && targetVersion && (
        <Stack
          className="db-moment"
          key="reveal"
          position="relative"
          gap={4}
          alignItems="center"
          w="full"
          maxW="40rem"
        >
          {homeButton}
          {round.status === 'won' && <WinBurst key={roundKey} color={revealColor} />}
          <Box
            style={{ color: round.status === 'won' ? GOLD : WILT }}
            fontFamily="display"
            fontSize="sm"
            fontWeight="700"
            letterSpacing="0.16em"
            textTransform="uppercase"
          >
            {round.status === 'won' ? t('dreamBelievers.correct') : t('dreamBelievers.reveal')}
          </Box>

          {targetVersion.jacket ? (
            <Box
              className="db-cascade"
              style={{
                boxShadow: `0 24px 60px -18px ${revealColor}, 0 0 0 3px ${revealColor}55`
              }}
              borderRadius="3xl"
              w={{ base: '200px', sm: '236px' }}
              h={{ base: '200px', sm: '236px' }}
              overflow="hidden"
            >
              <img
                src={jacketUrl(targetVersion.jacket)}
                alt={versionLabel(targetVersion, locale)}
                width={236}
                height={236}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </Box>
          ) : (
            targetVersion.member && (
              <Box
                className="db-cascade"
                style={{
                  borderColor: revealColor,
                  boxShadow: `0 22px 54px -16px ${revealColor}`
                }}
                position="relative"
                borderRadius="3xl"
                borderWidth="2px"
                w={{ base: '150px', sm: '176px' }}
                h={{ base: '210px', sm: '246px' }}
                overflow="hidden"
              >
                <img
                  src={getPicUrl(targetVersion.member.id, 'character')}
                  alt={targetVersion.member[locale]}
                  width={176}
                  height={246}
                  style={{
                    objectFit: 'cover',
                    objectPosition: 'center top',
                    width: '100%',
                    height: '100%'
                  }}
                />
                <Box
                  style={{ background: `linear-gradient(to top, ${revealColor}66, transparent)` }}
                  insetX={0}
                  position="absolute"
                  bottom={0}
                  h="45%"
                  pointerEvents="none"
                />
              </Box>
            )
          )}

          <Stack gap={2} alignItems="center">
            <Box
              color="fg.default"
              fontFamily="display"
              fontSize="3xl"
              fontWeight="900"
              textAlign="center"
            >
              {versionLabel(targetVersion, locale)}
            </Box>
            <Box style={{ background: revealColor }} borderRadius="full" w="42px" h="3px" />
            {targetVersion.gen && (
              <Box
                className="db-glass"
                style={{ color: revealColor }}
                borderRadius="full"
                py="1"
                px="3"
                fontSize="xs"
                fontWeight="600"
                letterSpacing="wider"
              >
                {t(`dreamBelievers.gen.${targetVersion.gen}`, { defaultValue: targetVersion.gen })}
              </Box>
            )}
          </Stack>

          <HStack className="db-glass" gap={{ base: 6, sm: 8 }} borderRadius="2xl" py={3} px={6}>
            {[
              { label: t('dreamBelievers.stats.played'), value: String(game.stats.played) },
              { label: t('dreamBelievers.stats.winRate'), value: `${winRate}%` },
              { label: t('dreamBelievers.stats.streak'), value: String(game.stats.streak) }
            ].map((s) => (
              <Stack key={s.label} gap={0.5} alignItems="center">
                <Box color="fg.default" fontFamily="display" fontSize="2xl" fontWeight="700">
                  {s.value}
                </Box>
                <Box
                  color="fg.subtle"
                  fontSize="2xs"
                  letterSpacing="wider"
                  textTransform="uppercase"
                >
                  {s.label}
                </Box>
              </Stack>
            ))}
          </HStack>

          <HStack gap={3} pt={1}>
            <button
              type="button"
              onClick={() => startRound(false)}
              className={primaryBtn}
              style={{
                background: 'linear-gradient(135deg,#ff8fbf,#e85a97)',
                boxShadow: '0 16px 40px -12px rgba(232,90,151,0.7)'
              }}
            >
              {t('dreamBelievers.nextRound')}
            </button>
            <button type="button" onClick={share} className={ghostBtn}>
              <FaShareNodes /> {t('dreamBelievers.share')}
            </button>
          </HStack>

          <Stack
            className="db-glass"
            gap={3}
            borderRadius="2xl"
            w="full"
            p={{ base: 4, sm: 5 }}
            pt={4}
          >
            <Box
              color="fg.default"
              fontFamily="display"
              fontSize="sm"
              fontWeight="700"
              textAlign="center"
            >
              {t('dreamBelievers.soundboard')}
            </Box>
            <Box color="fg.subtle" fontSize="xs" lineHeight="1.6" textAlign="center">
              {t('dreamBelievers.compareHint')}
            </Box>

            <HStack justifyContent="center">
              <Box
                style={{ borderColor: revealColor, color: revealColor }}
                borderRadius="full"
                borderWidth="1px"
                py="1"
                px="3"
                fontSize="xs"
                fontWeight="700"
              >
                {t('dreamBelievers.questionClip', { seconds: game.revealDuration })}
              </Box>
            </HStack>

            {error ? (
              <Box color="#d96b7a" textAlign="center">
                {t('dreamBelievers.audioError')}
              </Box>
            ) : (
              <Grid gap="2" gridTemplateColumns={{ base: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }}>
                {revealVersions.map((v, i) => {
                  const active = v.key === state.activeKey && state.playing;
                  return (
                    <button
                      key={v.key}
                      type="button"
                      disabled={loading}
                      onClick={() => playSound(v.key)}
                      className={`db-cascade ${css({
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '2',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderColor: active ? 'accent.default' : 'border.default',
                        borderRadius: 'lg',
                        borderWidth: '1px',
                        minH: '48px',
                        py: '2',
                        px: '3',
                        color: active ? 'white' : 'fg.default',
                        fontSize: 'sm',
                        fontWeight: '700',
                        bg: active ? 'accent.default' : 'transparent',
                        transition: 'transform 0.12s, background 0.2s, border-color 0.2s',
                        _disabled: { cursor: 'not-allowed', opacity: 0.5 },
                        _active: { transform: 'translateY(1px)' },
                        _hover: { borderColor: 'accent.default' }
                      })}`}
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <FaPlay size={12} />
                      <span>{versionLabel(v, locale)}</span>
                    </button>
                  );
                })}
              </Grid>
            )}
            <HStack justifyContent="center">{volumeControl}</HStack>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
