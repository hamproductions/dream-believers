import { FaPause, FaPlay } from 'react-icons/fa6';
import { Box } from 'styled-system/jsx';
import { css } from 'styled-system/css';
import { jacketUrl } from '~/utils/dream-believers/data';

export function RecordDisc({
  art,
  mystery,
  playing,
  progress,
  color,
  onToggle,
  spinIdle,
  playLabel,
  pauseLabel
}: {
  art?: string | null;
  mystery?: boolean;
  playing: boolean;
  progress?: number;
  color: string;
  onToggle?: () => void;
  spinIdle?: boolean;
  playLabel?: string;
  pauseLabel?: string;
}) {
  const spinning = playing || spinIdle;
  return (
    <Box position="relative" w={{ base: '232px', sm: '288px' }} h={{ base: '232px', sm: '288px' }}>
      <Box className="db-bloom" />
      <Box
        className="db-ring"
        style={{ ['--p' as string]: `${progress ?? 0}`, ['--rc' as string]: color }}
      />
      <Box className="db-disc db-spin" data-paused={!spinning} w="full" h="full">
        <Box className="db-disc-label">
          {mystery || !art ? (
            <div className="db-disc-mystery">♪</div>
          ) : (
            <img src={jacketUrl(art)} alt="" width={288} height={288} />
          )}
        </Box>
        <Box className="db-disc-hole" />
      </Box>
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? pauseLabel : playLabel}
          className={css({
            cursor: 'pointer',
            display: 'flex',
            zIndex: 4,
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 'full',
            w: '72px',
            h: '72px',
            color: 'white',
            transition: 'transform 0.12s',
            _active: { transform: 'translate(-50%, -50%) scale(0.96)' },
            _hover: { transform: 'translate(-50%, -50%) scale(1.06)' }
          })}
          style={{
            background: `radial-gradient(circle at 38% 32%, ${color}, ${color}cc)`,
            boxShadow: `0 12px 30px -8px ${color}, inset 0 1px 0 rgba(255,255,255,0.5)`
          }}
        >
          {playing ? <FaPause size={24} /> : <FaPlay size={24} style={{ marginLeft: 3 }} />}
        </button>
      )}
    </Box>
  );
}
