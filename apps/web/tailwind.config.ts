import type { Config } from "tailwindcss";

// teaOS design system — dark-mode only, enterprise-restrained.
//
// Direction (2026-07-28 frontend redesign): flat opaque surfaces instead of
// glassmorphism, one accent (`primary`) carried sparingly, semantic status
// colors reserved for status only, and a real monospace face for the
// hashes / tx ids / storage roots this product shows everywhere.
//
// Token *names* are unchanged from the previous theme on purpose — the public
// landing page (pages/landing/*) styles itself off the same tokens and must
// not be orphaned. Only the values moved, plus the additive tokens below.
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(222 20% 6%)",
        foreground: "hsl(210 20% 94%)",

        // Surface ramp. `card` is opaque now (was 60% alpha + blur).
        card: "hsl(222 18% 9%)",
        elevated: "hsl(222 16% 12%)",
        overlay: "hsl(222 22% 4% / 0.72)",

        border: "hsl(222 14% 18%)",
        "border-strong": "hsl(222 12% 28%)",

        primary: {
          DEFAULT: "hsl(212 92% 60%)",
          foreground: "hsl(222 40% 8%)",
        },
        // Retained for the landing page's existing `text-accent` usage and
        // the one secondary chart series. Not used as a second UI accent.
        accent: {
          DEFAULT: "hsl(255 70% 72%)",
          foreground: "hsl(222 40% 8%)",
        },
        muted: {
          DEFAULT: "hsl(222 16% 14%)",
          foreground: "hsl(215 12% 58%)",
        },

        success: "hsl(152 52% 46%)",
        warning: "hsl(38 88% 56%)",
        danger: "hsl(358 68% 58%)",
        info: "hsl(199 80% 54%)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "JetBrains Mono",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      letterSpacing: {
        label: "0.06em",
      },
      borderRadius: { lg: "10px", md: "8px", sm: "5px" },
      backdropBlur: { xs: "2px" },
      boxShadow: {
        // Kept (name-compatible) but far quieter than the old glass shadow.
        glass: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
        panel: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
        raised: "0 8px 24px -12px rgb(0 0 0 / 0.7)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
