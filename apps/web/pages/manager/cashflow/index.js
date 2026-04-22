/**
 * /manager/cashflow — redirects to /manager/finance?tab=planning.
 *
 * The cashflow plan list has been merged into the Finance hub as the
 * "Planning" tab. This shell exists as a belt-and-suspenders fallback
 * alongside the next.config.js redirect, which handles the common case.
 * SSR redirect fires for cases where the config-level redirect is bypassed
 * (e.g. client-side navigations that don't re-evaluate config redirects).
 */
export function getServerSideProps() {
  return {
    redirect: {
      destination: "/manager/finance?tab=planning",
      permanent: true,
    },
  };
}

export default function CashflowRedirect() {
  return null;
}
