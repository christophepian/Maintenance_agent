import AppShell from "../../components/AppShell";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";

export default function ContractorEstimatesPlaceholder() {
  const { t } = useTranslation("contractor");
  return (
    <AppShell role="CONTRACTOR">
      <div className="max-w-[900px]">
        <h1 className="mt-0">{t("contractor:estimates.heading.estimates")}</h1>
        <p className="text-muted">{t("contractor:estimates.text.comingSoonEstimateDraftingAndApproval")}</p>
      </div>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","contractor"]);
