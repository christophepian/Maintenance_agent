import { proxyToBackend } from "../../../lib/proxy";

export default async function handler(req, res) {
  const { id, action } = req.query;

  if (req.method === "GET" && !id) {
    await proxyToBackend(req, res, "/owner/pending-approvals");
    return;
  }

  if (req.method === "POST" && id && action === "approve") {
    await proxyToBackend(req, res, `/requests/${id}/owner-approve`);
    return;
  }

  if (req.method === "POST" && id && action === "reject") {
    await proxyToBackend(req, res, `/requests/${id}/owner-reject`);
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
