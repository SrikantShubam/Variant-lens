import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep Space Theme
        background: "#0a0a0f",
        surface: "#1a1a2e",
        "surface-light": "#252542",
        
        // Bioluminescence Palette
        primary: "#00f5d4",     // Cyan glow
        secondary: "#7b2cbf",   // Plasma violet
        tertiary: "#4361ee",    // Data stream blue
        accent: "#00f5d4",      // Same as primary for consistency
        
        // Utility Colors
        muted: "#64748b",
        foreground: "#f0f0f0",
        "foreground-muted": "#a1a1aa",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "scientific-gradient": "linear-gradient(135deg, #00f5d4 0%, #4361ee 50%, #7b2cbf 100%)",
        "mesh-gradient": "radial-gradient(at 40% 20%, hsla(174, 95%, 48%, 0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(262, 62%, 46%, 0.15) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(228, 83%, 60%, 0.15) 0px, transparent 50%)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 8s linear infinite",
        "fade-up": "fadeUp 0.5s ease-out forwards",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 245, 212, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(0, 245, 212, 0.6)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      boxShadow: {
        "glow": "0 0 20px rgba(0, 245, 212, 0.3)",
        "glow-lg": "0 0 40px rgba(0, 245, 212, 0.4)",
        "glow-violet": "0 0 20px rgba(123, 44, 191, 0.4)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
