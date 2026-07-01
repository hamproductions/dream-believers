import type { ReactNode } from 'react';
import { createContext, useContext, useEffect } from 'react';
import { useLocalStorage } from '~/hooks/useLocalStorage';

type ColorModes = 'dark' | 'light';
const ColorModeContext = createContext<{
  colorMode?: ColorModes | null;
  setColorMode?: (mode: ColorModes) => void;
}>({});

// 昼桜 (light) and 夜桜 (dark) are both fully-themed sakura worlds.
export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorMode] = useLocalStorage<ColorModes>('color-mode', undefined);

  useEffect(() => {
    if (colorMode === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    if (colorMode !== undefined) return;
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    setColorMode(prefersDark ? 'dark' : 'light');
  }, [colorMode, setColorMode]);

  return (
    <>
      <script
        lang="js"
        dangerouslySetInnerHTML={{
          __html: `
            const m = localStorage.getItem('color-mode');
            const dark = m === '"dark"' || (m === null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.documentElement.classList.add(dark ? 'dark' : 'light');
          `
        }}
      />
      <ColorModeContext.Provider value={{ colorMode, setColorMode }}>
        {children}
      </ColorModeContext.Provider>
    </>
  );
}

export const useColorModeContext = () => useContext(ColorModeContext);
