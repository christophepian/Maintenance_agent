import { create } from "storybook/theming/create";

// Brand the Storybook chrome + docs to match the app (indigo brand, slate
// surfaces, system-ui type). Mirrors the globals.css token values.
export default create({
  base: "light",

  brandTitle: "Maintenance Agent · Design System",
  brandUrl: "/",
  brandTarget: "_self",

  colorPrimary: "#4f46e5", // --color-brand
  colorSecondary: "#4f46e5",

  // UI
  appBg: "#f8fafc", // slate-50 (app bg)
  appContentBg: "#ffffff", // surface
  appPreviewBg: "#ffffff",
  appBorderColor: "#e2e8f0", // surface-border
  appBorderRadius: 10,

  // Typography
  fontBase: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  fontCode: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',

  // Text
  textColor: "#0f172a", // foreground
  textInverseColor: "#ffffff",
  textMutedColor: "#64748b", // muted

  // Toolbar
  barTextColor: "#64748b",
  barSelectedColor: "#4f46e5",
  barHoverColor: "#4f46e5",
  barBg: "#ffffff",

  // Form
  inputBg: "#ffffff",
  inputBorder: "#e2e8f0",
  inputTextColor: "#0f172a",
  inputBorderRadius: 8,
});
