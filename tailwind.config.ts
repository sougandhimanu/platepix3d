import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d1117",
        panel: "#141b24",
        edge: "#233040",
        brand: {
          DEFAULT: "#ff7a45",
          soft: "#ffb08a",
          deep: "#c74a1d",
        },
        accent: "#3ddc97",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
