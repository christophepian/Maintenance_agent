import { proxyToBackend } from "../../../lib/proxy";

export default async function handler(req, res) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (v) qs.set(k, String(v));
  }
  const qstr = qs.toString();
  await proxyToBackend(req, res, `/rent-adjustments${qstr ? "?" + qstr : ""}`);
}
