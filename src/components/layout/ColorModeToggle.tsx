import { useTranslation } from 'react-i18next';
import { FaMoon, FaSun } from 'react-icons/fa6';
import { css } from 'styled-system/css';
import { useColorModeContext } from '~/context/ColorModeContext';

export function ColorModeToggle() {
  const { t } = useTranslation();
  const { colorMode, setColorMode } = useColorModeContext();
  const isDark = colorMode === 'dark';
  return (
    <button
      type="button"
      aria-label={t(isDark ? 'dreamBelievers.theme.toDay' : 'dreamBelievers.theme.toNight')}
      onClick={() => setColorMode?.(isDark ? 'light' : 'dark')}
      className={css({
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        borderColor: 'border.default',
        borderRadius: 'full',
        borderWidth: '1px',
        w: '36px',
        h: '36px',
        color: 'accent.default',
        bg: 'bg.subtle',
        transition: 'all 0.2s',
        _active: { transform: 'translateY(1px)' },
        _hover: { borderColor: 'accent.default' }
      })}
    >
      {isDark ? <FaMoon size={15} /> : <FaSun size={15} />}
    </button>
  );
}
