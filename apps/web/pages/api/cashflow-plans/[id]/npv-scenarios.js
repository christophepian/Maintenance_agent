import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  // This endpoint is read-only — reject other verbs rather than proxying them.
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }
  const { id } = req.query;
  // Encode the path segment so a crafted id can't alter the backend path (CR-026).
  await proxyToBackend(req, res, `/cashflow-plans/${encodeURIComponent(id)}/npv-scenarios`);
}
