/** @type {import('next-i18next').UserConfig} */
module.exports = {
  i18n: {
    // Extend this array when DE / IT are ready: ['en', 'fr', 'de', 'it']
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    // Disable Accept-Language auto-detection. Locale is opt-in via NEXT_LOCALE
    // cookie or explicit /fr/ path prefix only. Without this, French-browser
    // users get French strings on all pages regardless of URL.
    localeDetection: false,
  },
  defaultNS: 'common',
  ns: ['common', 'manager', 'owner', 'contractor', 'tenant'],
  fallbackLng: 'en',            // missing FR keys silently fall back to EN
  reloadOnPrerender: process.env.NODE_ENV === 'development', // always re-read locale files in dev
};
