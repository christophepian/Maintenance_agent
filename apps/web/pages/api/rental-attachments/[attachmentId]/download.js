import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { attachmentId } = req.query;
  await proxyToBackend(req, res, `/rental-attachments/${attachmentId}/download`, {
    binary: true,
  });
}
