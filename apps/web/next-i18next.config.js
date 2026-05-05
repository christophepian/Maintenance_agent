/** @type {import('next-i18next').UserConfig} */
module.exports = {
  i18n: {
    // Extend this array when DE / IT are ready: ['en', 'fr', 'de', 'it']
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    localeDetection: true,       // use Accept-Language on first visit
    localeCookie: 'NEXT_LOCALE', // remember choice across sessions
  },
  defaultNS: 'common',
  ns: ['common', 'manager', 'owner', 'contractor', 'tenant'],
  fallbackLng: 'en',            // missing FR keys silently fall back to EN
};
