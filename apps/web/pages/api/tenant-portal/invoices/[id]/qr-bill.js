import { proxyToBackend } from "../../../../../lib/proxy";

export default async function handler(req, res) {
  const { id } = req.query;
  await proxyToBackend(req, res, `/tenant-portal/invoices/${id}/qr-bill`);
}
