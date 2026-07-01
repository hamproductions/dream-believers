# Design System: Dream Believers Guessr

Documents the shipped visual system (Panda CSS tokens in `src/theme/index.ts`, global CSS in `src/index.css`). The aesthetic is the real Dream Believers / 蓮ノ空 world: soft, dreamy, sakura-pink, warm.

## 1. Visual Theme & Atmosphere
A **sakura daydream**: a light, airy, romantic idol-song world. The page is bathed in a soft pink-to-lavender gradient with **cherry-blossom petals drifting down**, over which frosted-white cards float. It feels like the Dream Believers album art come to life: pastel, gentle, hopeful, unmistakably an idol love-letter, never a dark tech template. Density is focused (one card at a time), motion is soft and perpetual (falling petals, gentle floats, spring pops), the mood is joyful and warm.

## 2. Color Palette & Roles
- **Blossom Canvas** (#FFF6FB) — Primary background; layered with dreamy radial washes of Petal Pink and a lavender hint, plus a bottom sakura glow.
- **Cloud White** (#FFFFFF) — Card and panel fill; frosted, floating surfaces.
- **Blush Mist** (#FFE7F2) — Muted fills (chips, progress track, inactive toggle track).
- **Petal Deep** (#FFD3E6) — Emphasized fills.
- **Cerise Bloom** (#E85A97) — The single accent: primary CTAs, active state, focus ring, progress fill, the eyebrow label. Warm rose, luminous, never neon; white text on it for large/bold only.
- **Cerise Pressed** (#D94484) — Accent hover/pressed.
- **Plum Ink** (#5A2F49) — Primary text; a deep warm mauve that reads clearly on the light wash.
- **Dusk Mauve** (#9A6683) — Secondary text, metadata, labels.
- **Soft Mauve** (#B98AA4) — Tertiary / captions.
- **Petal Hairline** (rgba(232,90,151,0.20)) — 1px card borders and dividers.
- Functional feedback only (not brand chroma): **Correct** jade (#4FB286), **Wrong** rose (#D96B7A).

Falling petals use a radial `#ffe3f0 → #ff9ec6 → #f26fae` gradient with a soft rose drop-shadow.

## 3. Typography Rules
- **Display / headings:** `Zen Maru Gothic` (900) — rounded, warm, hand-set; the idol-cute character font. Hierarchy by weight + color, track-tight.
- **Body:** `Outfit` (400/500) — relaxed, friendly, ≤65ch, Dusk Mauve for secondary.
- **Mono:** `JetBrains Mono` — timecodes, offsets, stats numbers, and the small letterspaced eyebrow.
- No Inter, no serif.

## 4. Component Stylings
* **Buttons:** Pill-shaped. Primary = Cerise Bloom fill with white label, hover to Cerise Pressed, tactile `translateY(1px)` on press. Secondary = hairline outline, Plum Ink label. No glow.
* **Cards / panels:** Cloud White, generously rounded (`2xl`), 1px Petal Hairline border, soft rose-tinted shadow (`0 24px 60px -30px rgba(226,78,142,0.28)`). Float over the petal field.
* **Segmented / toggle:** Blush Mist track, Cerise Bloom active thumb; the solo toggle is a role=switch pill.
* **Reveal dots:** rounded squares that spring-pop as guesses land (jade = correct, rose = wrong, cerise ring = current).
* **Member portrait (solo reveal):** circular, Cerise ring + soft rose glow, gentle infinite float.
* **Loading:** rose shimmer sweep across the progress track (never a spinner).
* **Section chip:** Blush Mist pill, Cerise label, reads "Now playing: {section}".

## 5. Layout Principles
Single focused column, max-width ~30rem for the game card. The hero (eyebrow + Zen Maru title + subtitle + settings) shows only on the start screen; when a round begins it collapses so the player + guesses sit above the fold. The reveal leads with the answer + Next/Share, with the synced-version explorer below a hairline divider. `min-h-[100dvh]`, mobile collapses to a single column with 44px tap targets, no horizontal overflow.

## 6. Motion & Interaction
Perpetual gentle motion sells the dream: **falling sakura petals** (ambient, always), staggered cascade on guess pills, spring pop on reveal dots, floating portrait, shimmer while audio decodes. Transform/opacity only. `prefers-reduced-motion` collapses the UI animations; petals slow to a very gentle drift rather than vanishing.

## 7. Anti-Patterns (Banned)
No dark/charcoal base (this is a light dreamy world). No neon or outer glow. No pure black or white text. No em-dashes. No AI-purple. No generic 3-equal-card row. No untranslated section/gen labels leaking into English. No fabricated stats — only the player's real timecode and the user's own play/win/streak counts.
