import { useEffect } from "react";
import { useRouter } from "next/router";
import { withTranslations } from "../../lib/i18n";

export default function ManagerAssetsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin-inventory");
  }, [router]);
  return null;
}

export const getStaticProps = withTranslations(["common","manager"]);
