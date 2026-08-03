import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  const { id, ...rest } = req.query;
  const params = new URLSearchParams(rest).toString();
  await proxyToBackend(req, res, `/buildings/${id}/unit-financials${params ? `?${params}` : ""}`);
}
