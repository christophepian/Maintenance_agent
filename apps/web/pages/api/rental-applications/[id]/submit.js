import { proxyToBackend } from "../../../../lib/proxy";

// Dedicated route for POST /rental-applications/:id/submit
// Separate from the catch-all [...id] route which has bodyParser: false for multipart uploads.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { id } = req.query;
  await proxyToBackend(req, res, `/rental-applications/${id}/submit`);
}
