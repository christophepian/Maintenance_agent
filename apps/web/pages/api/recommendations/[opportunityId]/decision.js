import { proxyToBackend } from "../../../../../lib/proxy";

export default async function handler(req, res) {
  const { opportunityId } = req.query;
  await proxyToBackend(req, res, `/recommendations/${opportunityId}/decision`);
}
