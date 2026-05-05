import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

/**
 * Use on pages with NO existing getStaticProps / getServerSideProps:
 *
 *   export const getStaticProps = withTranslations(['common', 'manager']);
 *
 * When DE / IT are added, only next-i18next.config.js changes — zero page files touched.
 */
export function withTranslations(namespaces) {
  return async ({ locale }) => ({
    props: { ...(await serverSideTranslations(locale, namespaces)) },
  });
}

/**
 * Use on pages that already have a getStaticProps / getServerSideProps with real logic:
 *
 *   export const getStaticProps = composeWithTranslations(
 *     ['common', 'manager'],
 *     async ({ locale, params }) => {
 *       return { props: { data: await fetchSomething(params.id) } };
 *     }
 *   );
 */
export function composeWithTranslations(namespaces, getPropsFunc) {
  return async (context) => {
    const i18nProps = await serverSideTranslations(context.locale, namespaces);
    const result = await getPropsFunc(context);
    return { ...result, props: { ...i18nProps, ...(result.props ?? {}) } };
  };
}
