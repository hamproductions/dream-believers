import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SyncedVersionPlayer,
  type SyncedPlayerState,
  type SyncedTrack
} from '~/utils/dream-believers/SyncedVersionPlayer';
import { analyserBus } from '~/utils/dream-believers/analyserBus';

const EMPTY: SyncedPlayerState = {
  playing: false,
  position: 0,
  duration: 0,
  activeKey: '',
  loadedKeys: []
};

export function useSyncedPlayer(tracks: SyncedTrack[], order: string[], activeKey: string) {
  const playerRef = useRef<SyncedVersionPlayer | null>(null);
  const [state, setState] = useState<SyncedPlayerState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const tracksKey = tracks.map((t) => `${t.key}:${t.url}`).join('|');

  useEffect(() => {
    const player = new SyncedVersionPlayer();
    playerRef.current = player;
    const unsub = player.subscribe(setState);
    let cancelled = false;
    setLoading(true);
    setError(false);
    player
      .load(tracks, order)
      .then(() => {
        if (cancelled) return undefined;
        if (activeKey) player.switchTo(activeKey);
        setLoading(false);
        return undefined;
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('SyncedVersionPlayer load failed', e);
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      unsub();
      player.destroy();
      playerRef.current = null;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed on tracksKey; recreating per dep would thrash the player
  }, [tracksKey]);

  const play = useCallback((pos?: number) => void playerRef.current?.play(pos), []);
  const pause = useCallback(() => playerRef.current?.pause(), []);
  const seek = useCallback((pos: number) => playerRef.current?.seek(pos), []);
  const switchTo = useCallback((key: string) => playerRef.current?.switchTo(key), []);
  const setTrackOffset = useCallback(
    (key: string, ms: number) => playerRef.current?.setTrackOffset(key, ms),
    []
  );
  const setClip = useCallback(
    (start: number, end: number | null) => playerRef.current?.setClip(start, end),
    []
  );
  const clearClip = useCallback(() => playerRef.current?.clearClip(), []);
  const setVolume = useCallback((v: number) => playerRef.current?.setVolume(v), []);
  const getAnalyser = useCallback(() => playerRef.current?.getAnalyser() ?? null, []);

  useEffect(() => {
    analyserBus.set(getAnalyser);
    return () => analyserBus.set(null);
  }, [getAnalyser]);
  const toggle = useCallback(
    (pos?: number) => {
      const p = playerRef.current;
      if (!p) return;
      if (state.playing) p.pause();
      else void p.play(pos);
    },
    [state.playing]
  );

  return {
    state,
    loading,
    error,
    play,
    pause,
    toggle,
    seek,
    switchTo,
    setTrackOffset,
    setClip,
    clearClip,
    setVolume,
    getAnalyser
  };
}
