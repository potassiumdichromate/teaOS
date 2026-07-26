import type { Config } from "tailwindcss";

// Government-grade dark theme: deep navy base, blue/purple accents,
// glassmorphism surfaces per knowledge_base.md UI requirements.
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(230 35% 7%)",
        foreground: "hsl(220 20% 96%)",
        card: "hsl(230 30% 11% / 0.6)",
        border: "hsl(230 20% 24%)",
        primary: {
          DEFAULT: "hsl(217 91% 60%)",
          foreground: "hsl(220 20% 98%)",
        },
        accent: {
          DEFAULT: "hsl(262 83% 66%)",
          foreground: "hsl(220 20% 98%)",
        },
        muted: {
          DEFAULT: "hsl(230 20% 18%)",
          foreground: "hsl(220 10% 65%)",
        },
        success: "hsl(152 60% 45%)",
        warning: "hsl(38 92% 55%)",
        danger: "hsl(0 72% 58%)",
      },
      borderRadius: { lg: "12px", md: "8px", sm: "4px" },
      backdropBlur: { xs: "2px" },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
