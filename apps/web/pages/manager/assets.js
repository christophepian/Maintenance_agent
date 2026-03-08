import { useEffect } from "react";
import { useRouter } from "next/router";

export default function ManagerAssetsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin-inventory");
  }, [router]);
  return null;
}
