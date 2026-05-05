/** @type {import('next-i18next').UserConfig} */
module.exports = {
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
};
