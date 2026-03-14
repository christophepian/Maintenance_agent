/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./layouts/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        subtle:       "var(--color-text-subtle)",
        muted:        "var(--color-text-muted)",
        "muted-light":"var(--color-text-muted-light)",
        heading:      "var(--color-text-heading)",
        "tab-active": "var(--color-tab-active)",
        "tab-inactive":"var(--color-tab-inactive)",
        "tbl-head":   "var(--color-table-head)",
        "tbl-border": "var(--color-table-border)",
        "tbl-row":    "var(--color-table-row-border)",
        loading:      "var(--color-loading)",
        "cs-bg":      "var(--color-coming-soon-bg)",
        "cs-text":    "var(--color-coming-soon)",
        "err-text":   "var(--color-text-error)",
        "ok-text":    "var(--color-text-ok)",
        "err-banner": "var(--color-text-error-banner)",
      },
      borderRadius: {
        pill:   "var(--radius-pill)",
        banner: "var(--radius-banner)",
      },
    },
  },
  plugins: [],
};
