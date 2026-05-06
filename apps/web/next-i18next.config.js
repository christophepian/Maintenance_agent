const path = require('path');

/** @type {import('next-i18next').UserConfig} */
module.exports = {
  localePath: path.resolve(__dirname, './public/locales'),
  i18n: {
    // Extend this array when DE / IT are ready: ['en', 'fr', 'de', 'it']
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    // localeDetection: Next.js reads the NEXT_LOCALE cookie automatically.
    // Set to false to disable Accept-Language auto-detection (opt-in only).
  },
  defaultNS: 'common',
  ns: ['common', 'manager', 'owner', 'contractor', 'tenant'],
  fallbackLng: 'en',            // missing FR keys silently fall back to EN
  reloadOnPrerender: process.env.NODE_ENV === 'development', // always re-read locale files in dev
};
