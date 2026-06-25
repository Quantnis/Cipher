import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        slate: {
          base: "#0D1117",
          surface: "#161B22",
          card: "#21262D",
          elevated: "#2D333B",
          border: "#30363D",
          strong: "#484F58"
        },
        ink: {
          primary: "#E6EDF3",
          secondary: "#8B949E",
          muted: "#484F58"
        },
        signal: {
          critical: "#F85149",
          warning: "#D29922",
          safe: "#3FB950",
          info: "#2F81F7",
          accent: "#79C0FF"
        },
        threat: {
          vape: "#D29922",
          crypto: "#BC8CFF",
          alcohol: "#79C0FF",
          drugs: "#F85149",
          contraband: "#E09B3D",
          leak: "#2F81F7",
          hidden: "#A5A5A5"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      animation: {
        "border-beam": "border-beam calc(var(--duration)*1s) infinite linear"
      },
      keyframes: {
        "border-beam": {
          "100%": {
            "offset-distance": "100%"
          }
        }
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
