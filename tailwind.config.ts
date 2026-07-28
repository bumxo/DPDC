import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette (corporate pharma blue, dygenpharma.com-inspired).
        // Adjust brand-600 (primary) and brand-700 (hover) to retune the app.
        brand: {
          50: "#EAF2FB",
          100: "#D4E4F7",
          200: "#A9C9EF",
          300: "#7EADE7",
          400: "#4A8BD8",
          500: "#2268B8",
          600: "#0B4EA2",
          700: "#093E82",
          800: "#072F63",
          900: "#052145",
        },
      },
    },
  },
  plugins: [],
};
export default config;
