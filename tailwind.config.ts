import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#F0F4FF",
        surface: "#FFFFFF",
        border: "rgba(59,130,246,0.10)",
        brand: "#2563EB",
        ink: "#102347",
        muted: "#6F7EA1"
      },
      boxShadow: {
        card: "0 20px 45px rgba(37, 99, 235, 0.12)",
        glow: "0 18px 50px rgba(37, 99, 235, 0.20)"
      },
      backgroundImage: {
        hero: "radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 45%), linear-gradient(180deg, #F8FBFF 0%, #F0F4FF 45%, #EEF3FF 100%)",
        cta: "linear-gradient(135deg, #22D3EE 0%, #2563EB 52%, #7C3AED 100%)"
      },
      fontFamily: {
        sans: [
          "\"DM Sans\"",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;
