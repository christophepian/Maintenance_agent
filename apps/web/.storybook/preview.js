// Loads the real Tailwind v4 tokens (@theme) + global component classes
// (.filter-input, .empty-state, .error-banner, body font stack, etc.)
import "../styles/globals.css";

/** @type {import('@storybook/react-vite').Preview} */
const preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    backgrounds: {
      options: {
        light: { name: "Light (app bg)", value: "#f8fafc" },
        surface: { name: "Surface", value: "#ffffff" },
        dark: { name: "Dark (#05081a)", value: "#05081a" },
      },
    },
  },
  initialGlobals: {
    backgrounds: { value: "light" },
  },
};

export default preview;
