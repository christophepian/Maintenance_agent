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

// Persona sidebar namespaces — always loaded so the role switcher can render
// any sidebar (TenantSidebar, OwnerSidebar, etc.) without raw translation keys
// showing on pages that don't explicitly declare those namespaces.
const ALWAYS_LOAD_NS = ['common', 'manager', 'owner', 'tenant', 'contractor'];

function mergeNs(namespaces) {
  return [...new Set([...ALWAYS_LOAD_NS, ...namespaces])];
}

// getStaticProps — runs at build time, no path issue, no explicit config needed.
export function withTranslations(namespaces) {
  return async ({ locale }) => ({
    props: { ...(await serverSideTranslations(locale ?? 'en', mergeNs(namespaces))) },
  });
}

// getServerSideProps — runs in Lambda at request time, needs explicit localePath.
export function withServerTranslations(namespaces) {
  return async ({ locale }) => ({
    props: { ...(await serverSideTranslations(locale ?? 'en', mergeNs(namespaces), ssrConfig())) },
  });
}

export function composeWithTranslations(namespaces, getPropsFunc) {
  return async (context) => {
    const i18nProps = await serverSideTranslations(context.locale ?? 'en', mergeNs(namespaces), ssrConfig());
    const result = await getPropsFunc(context);
    return { ...result, props: { ...i18nProps, ...(result.props ?? {}) } };
  };
}
