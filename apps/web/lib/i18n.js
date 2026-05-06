import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export function withTranslations(namespaces) {
  return async ({ locale }) => ({
    props: { ...(await serverSideTranslations(locale ?? 'en', namespaces)) },
  });
}

export function withServerTranslations(namespaces) {
  return async ({ locale }) => ({
    props: { ...(await serverSideTranslations(locale ?? 'en', namespaces)) },
  });
}

export function composeWithTranslations(namespaces, getPropsFunc) {
  return async (context) => {
    const i18nProps = await serverSideTranslations(context.locale ?? 'en', namespaces);
    const result = await getPropsFunc(context);
    return { ...result, props: { ...i18nProps, ...(result.props ?? {}) } };
  };
}
