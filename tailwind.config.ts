import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        foreground: "#2c2241",
        brand: {
          pink: "#F48991",
          pinkSoft: "#FAD5D8",
          yellow: "#ffd35c",
          cyan: "#7bd8f7",
          peach: "#ffffff",
          mint: "#dff5df",
          ink: "#2c2241",
        },
      },
      fontFamily: {
        display: ["var(--font-baloo)", "sans-serif"],
        body: ["var(--font-nunito)", "sans-serif"],
      },
      boxShadow: {
        soft: "0 18px 50px rgba(244, 137, 145, 0.22)",
        card: "0 12px 30px rgba(44, 34, 65, 0.08)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top left, rgba(255, 211, 92, 0.16), transparent 38%), radial-gradient(circle at top right, rgba(244, 137, 145, 0.12), transparent 34%), linear-gradient(180deg, #ffffff 0%, #ffffff 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
