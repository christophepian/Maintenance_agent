import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  const { id, action } = req.query;
  const binary = action === "pdf" || action === "qr-code.png";
  await proxyToBackend(req, res, `/invoices/${id}/${action}`, { binary });
}
