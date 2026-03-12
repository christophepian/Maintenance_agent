import { proxyToBackend } from "../../../../lib/proxy";

/**
 * Disable Next.js body parsing so multipart uploads are forwarded raw.
 */
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const { id } = req.query;
  await proxyToBackend(req, res, `/tenant-portal/maintenance-attachments/${id}`);
}
