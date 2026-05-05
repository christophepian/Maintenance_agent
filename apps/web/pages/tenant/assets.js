import AppShell from "../../components/AppShell";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";

export default function TenantAssetsPage() {
  const { t } = useTranslation("tenant");
  return (
    <AppShell role="TENANT">
      <div className="main-container">
        <h1>{t("tenant:assets.heading.myUnitAmpAssets")}</h1>
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <span className="inline-block px-3 py-1 rounded-xl bg-sky-50 text-sky-700 text-xs font-semibold tracking-wide uppercase mb-3">{t("tenant:assets.text.comingSoon")}</span>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">{t("tenant:assets.heading.unitAmpAssetDetails")}</h2>
          <p className="text-sm text-slate-500 max-w-md">
            Your unit information, appliance inventory, and maintenance history
            will appear here.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","tenant"]);
