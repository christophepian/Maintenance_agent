import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";

export default function ContractorJobDetailPlaceholder() {
  const router = useRouter();
  const { id } = router.query;

  return (
    <AppShell role="CONTRACTOR">
      <div style={{ maxWidth: "900px" }}>
        <h1 style={{ marginTop: 0 }}>Job Detail</h1>
        <p style={{ color: "#666" }}>Coming soon: job context and updates.</p>
        {id ? <div style={{ color: "#888" }}>Job ID: {id}</div> : null}
      </div>
    </AppShell>
  );
}
