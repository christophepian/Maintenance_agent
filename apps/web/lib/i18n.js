import path from 'path';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

// Used only by getServerSideProps helpers (Lambda runtime).
// path.resolve('./public/locales') uses process.cwd() at call time, which on
// Vercel Lambdas is /var/task (= the Next.js project root = apps/web).
// We cannot rely on next-i18next auto-detecting the config in Lambda because
// public/ assets are not bundled into the Lambda filesystem.
function ssrConfig() {
  return {
    localePath: path.resolve('./public/locales'),
    i18n: {
      locales: ['en', 'fr'],
      defaultLocale: 'en',
    },
    defaultNS: 'common',
    ns: ['common', 'manager', 'owner', 'contractor', 'tenant'],
    fallbackLng: 'en',
  };
}

// getStaticProps — runs at build time, no path issue, no explicit config needed.
export function withTranslations(namespaces) {
  return async ({ locale }) => ({
    props: { ...(await serverSideTranslations(locale ?? 'en', namespaces)) },
  });
}

// getServerSideProps — runs in Lambda at request time, needs explicit localePath.
export function withServerTranslations(namespaces) {
  return async ({ locale }) => ({
    props: { ...(await serverSideTranslations(locale ?? 'en', namespaces, ssrConfig())) },
  });
}

export function composeWithTranslations(namespaces, getPropsFunc) {
  return async (context) => {
    const i18nProps = await serverSideTranslations(context.locale ?? 'en', namespaces, ssrConfig());
    const result = await getPropsFunc(context);
    return { ...result, props: { ...i18nProps, ...(result.props ?? {}) } };
  };
}
