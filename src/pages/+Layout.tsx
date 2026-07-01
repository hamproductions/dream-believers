import React from 'react';
import { Box, Container, HStack, Stack } from 'styled-system/jsx';
import { ColorModeToggle } from '~/components/layout/ColorModeToggle';
import { Footer } from '~/components/layout/Footer';
import { LanguageToggle } from '~/components/layout/LanguageToggle';
import { StageCanvas, useStage3DActive } from '~/components/dream-believers/StageCanvas';
import { useColorModeContext } from '~/context/ColorModeContext';

const PETALS = Array.from({ length: 16 }, (_, i) => {
  const h1 = (i * 73) % 101;
  const h2 = (i * 37) % 89;
  const h3 = (i * 53) % 97;
  const left = (i * 89) % 100;
  const tier = i % 3;
  const size = (tier === 0 ? 9 : tier === 1 ? 13 : 18) + (h2 % 4);
  const dur = 10 + (h1 % 900) / 100 + tier * 2;
  const delay = -((h3 % 100) / 100) * dur;
  const sway = (i % 2 === 0 ? 1 : -1) * (3 + (h1 % 11));
  const spin = 200 + (h2 % 320);
  const pop = tier === 0 ? 0.55 : tier === 1 ? 0.8 : 0.95;
  return { left, size, dur, delay, sway, spin, pop, tier };
});

function SakuraField() {
  return (
    <div className="sakura-field" aria-hidden>
      {PETALS.map((p, i) => (
        <span
          key={i}
          className="petal"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            // @ts-expect-error CSS custom properties
            '--sway': `${p.sway}vw`,
            '--spin': `${p.spin}deg`,
            '--pop': p.pop
          }}
        />
      ))}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { colorMode } = useColorModeContext();
  const dark = colorMode === 'dark';
  const stage3d = useStage3DActive();

  return (
    <Stack position="relative" gap={0} w="full" minH="100dvh">
      <div className="db-backdrop" aria-hidden />
      {stage3d ? <StageCanvas dark={dark} /> : <SakuraField />}

      <Container zIndex="1" position="relative" flex={1} w="full" py={4} px={4}>
        <Stack gap={0}>
          <HStack gap={2} justifyContent="flex-end" alignItems="center" w="full">
            <LanguageToggle />
            <ColorModeToggle />
          </HStack>
          <Box>{children}</Box>
        </Stack>
      </Container>
      <Footer />
    </Stack>
  );
}
