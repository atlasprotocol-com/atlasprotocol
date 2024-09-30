import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      sm: "600px",
      md: "768px",
      lg: "1000px",
      xl: "1130px",
      "2xl": "1350px",
    },
    extend: {
      colors: {
        primary: "#F35C1E",
        secondary: "#0DB7BF",
        "base-400": "hsl(var(--base-400) / <alpha-value>)",
      },
      gridTemplateColumns: {
        stakingFinalityProvidersMobile: "2fr 1fr",
        stakingFinalityProvidersDesktop: "2fr 1.5fr 2fr 0.75fr",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    darkTheme: "dark", // name of one of the included themes for dark mode
    // base: true,
    logs: false,
    themes: [
      {
        light: {
          ...require("daisyui/src/theming/themes")["light"],
          primary: "#F35C1E",
          secondary: "#0DB7BF",
          "base-100": "#F6F6F6",
          "base-200": "rgba(225, 225, 225, 0.3)",
          "base-300": "#FFF",
          "base-content": "#000",
          "--base-400": "0 0% 98%",
          ".btn-primary": {
            color: "#FFF",
            borderRadius: "20px",
          },
          ".btn-outline": {
            borderRadius: "20px",
          },
        },
      },
      {
        dark: {
          ...require("daisyui/src/theming/themes")["dark"],
          primary: "#F35C1E",
          secondary: "#0DB7BF",
          "base-100": "#000",
          "base-200": "#303030",
          "base-300": "#1E1E1E",
          "base-content": "#FFF",
          "--base-400": "0 0% 9.8%",
          ".btn-primary": {
            color: "#FFF",
            borderRadius: "20px",
          },
          ".btn-outline": {
            borderRadius: "20px",
          },
        },
      },
    ],
  },
};
export default config;