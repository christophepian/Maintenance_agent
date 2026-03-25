import { proxyToBackend } from "../../../../../lib/proxy";

export default async function handler(req, res) {
  const { id } = req.query;
  await proxyToBackend(req, res, `/contractor/jobs/${id}/rate`, {
    headers: { "X-Dev-Role": "CONTRACTOR" },
  });
}
