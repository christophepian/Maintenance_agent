import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  const { id, ...rest } = req.query;
  const qs = new URLSearchParams(rest).toString();
  const path = `/buildings/${id}/npv-scenarios${qs ? `?${qs}` : ""}`;
  await proxyToBackend(req, res, path);
}
