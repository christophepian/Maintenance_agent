import { proxyToBackend } from "../../../../../lib/proxy";

export default async function handler(req, res) {
  const { id } = req.query;
  await proxyToBackend(req, res, `/owner/rental-application-units/${id}/override-disqualification`);
}
