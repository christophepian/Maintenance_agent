import { useEffect } from "react";
import { useRouter } from "next/router";
import AppShell from "../components/AppShell";
import TenantPicker from "../components/TenantPicker";
import { withTranslations } from "../lib/i18n";

export default function TenantLogin() {
  const router = useRouter();

  useEffect(() => {
    const tenantToken =
      typeof window !== "undefined" && localStorage.getItem("tenantToken");
    if (tenantToken) {
      router.replace("/tenant/requests");
    } else {
      router.replace("/login?next=/tenant/requests");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell role="TENANT">
      <div className="main-container">
        <TenantPicker onSelect={() => router.push("/tenant/requests")} />
      </div>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common", "tenant"]);
