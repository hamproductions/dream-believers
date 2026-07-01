import { type PartialTheme } from '@pandacss/types';

export const theme: PartialTheme = {
  layerStyles: {
    textStroke: {
      value: {
        //@ts-expect-error TODO: incompatible type
        WebkitTextStrokeWidth: '0.23',
        //@ts-expect-error TODO: incompatible type
        WebkitTextStrokeColor: '{colors.fg.default}'
      }
    }
  },
  tokens: {
    fonts: {
      body: { value: "'Outfit', 'Zen Kaku Gothic New', system-ui, sans-serif" },
      heading: { value: "'Zen Kaku Gothic New', 'Outfit', sans-serif" },
      display: { value: "'Zen Kaku Gothic New', 'Outfit', sans-serif" },
      script: { value: "'Great Vibes', 'Zen Kaku Gothic New', cursive" },
      mono: { value: "'Outfit', ui-monospace, monospace" }
    },
    colors: {
      ll: {
        1: { value: '#fff6fb' },
        2: { value: '#ffedf5' },
        3: { value: '#ffdcec' },
        4: { value: '#ffc9e0' },
        5: { value: '#fbb0d0' },
        6: { value: '#f592bc' },
        7: { value: '#ee72a4' },
        8: { value: '#e85a92' },
        9: { value: '#e85a97' },
        10: { value: '#d94484' },
        11: { value: '#b83168' },
        12: { value: '#7a1f43' },
        a1: { value: '#ec001207' },
        a2: { value: '#f4206612' },
        a3: { value: '#fb17732f' },
        a4: { value: '#ff007247' },
        a5: { value: '#ff0c7e57' },
        a6: { value: '#ff2f8b69' },
        a7: { value: '#ff459586' },
        a8: { value: '#ff4998b2' },
        a9: { value: '#fe008ce3' },
        a10: { value: '#ff0088d1' },
        a11: { value: '#ff87b8' },
        a12: { value: '#ffd0e0' }
      }
    }
  },
  semanticTokens: {
    colors: {
      bg: {
        canvas: { value: { base: '#fff6fb', _dark: '#160f28' } },
        default: { value: { base: '#fff6fb', _dark: '#160f28' } },
        subtle: { value: { base: '#ffffff', _dark: '#241834' } },
        muted: { value: { base: '#ffe7f2', _dark: '#322247' } },
        emphasized: { value: { base: '#ffd3e6', _dark: '#402c59' } }
      },
      fg: {
        default: { value: { base: '#5a2f49', _dark: '#f6ecff' } },
        muted: { value: { base: '#8a5473', _dark: '#c3a9da' } },
        subtle: { value: { base: '#9a6280', _dark: '#9c82b8' } }
      },
      border: {
        default: { value: { base: 'rgba(232,90,151,0.20)', _dark: 'rgba(247,175,220,0.20)' } },
        muted: { value: { base: 'rgba(232,90,151,0.12)', _dark: 'rgba(247,175,220,0.12)' } },
        subtle: { value: { base: 'rgba(232,90,151,0.08)', _dark: 'rgba(247,175,220,0.08)' } }
      },
      accent: {
        1: { value: '{colors.ll.1}' },
        2: { value: '{colors.ll.2}' },
        3: { value: '{colors.ll.3}' },
        4: { value: '{colors.ll.4}' },
        5: { value: '{colors.ll.5}' },
        6: { value: '{colors.ll.6}' },
        7: { value: '{colors.ll.7}' },
        8: { value: '{colors.ll.8}' },
        9: { value: '{colors.ll.9}' },
        10: { value: '{colors.ll.10}' },
        11: { value: '{colors.ll.11}' },
        12: { value: '{colors.ll.12}' },
        a1: { value: '{colors.ll.a1}' },
        a2: { value: '{colors.ll.a2}' },
        a3: { value: '{colors.ll.a3}' },
        a4: { value: '{colors.ll.a4}' },
        a5: { value: '{colors.ll.a5}' },
        a6: { value: '{colors.ll.a6}' },
        a7: { value: '{colors.ll.a7}' },
        a8: { value: '{colors.ll.a8}' },
        a9: { value: '{colors.ll.a9}' },
        a10: { value: '{colors.ll.a10}' },
        a11: { value: '{colors.ll.a11}' },
        a12: { value: '{colors.ll.a12}' },
        default: {
          value: { base: '{colors.ll.11}', _dark: '{colors.ll.9}' }
        },
        emphasized: {
          value: { base: '{colors.ll.12}', _dark: '{colors.ll.10}' }
        },
        fg: {
          value: '{colors.white}'
        },
        text: {
          value: { base: '{colors.ll.11}', _dark: '{colors.ll.a11}' }
        }
      }
    }
  },
  keyframes: {
    rainbowScroll: {
      '0%': { backgroundPosition: '200% 50%' },
      '100%': { backgroundPosition: '0% 50%' }
    },
    cascadeIn: {
      '0%': { opacity: '0', transform: 'translateY(10px)' },
      '100%': { opacity: '1', transform: 'translateY(0)' }
    },
    popIn: {
      '0%': { transform: 'scale(0.6)' },
      '60%': { transform: 'scale(1.08)' },
      '100%': { transform: 'scale(1)' }
    },
    floaty: {
      '0%, 100%': { transform: 'translateY(-4px)' },
      '50%': { transform: 'translateY(4px)' }
    },
    shimmer: {
      '0%': { backgroundPosition: '-200% 0' },
      '100%': { backgroundPosition: '200% 0' }
    }
  },
  recipes: {}
};
