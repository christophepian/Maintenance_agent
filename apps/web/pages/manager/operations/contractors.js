import { useEffect } from "react";
import { useRouter } from "next/router";

export default function ManagerContractorsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/manager/people/vendors");
  }, [router]);
  return null;
}
