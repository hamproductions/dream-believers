import { Metadata } from '~/components/layout/Metadata';

export function Head() {
  return (
    <>
      <Metadata />
      <link
        rel="icon"
        type="image/svg+xml"
        href={`${import.meta.env.PUBLIC_ENV__BASE_URL ?? '/'}favicon.svg`}
      />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=Outfit:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
    </>
  );
}
