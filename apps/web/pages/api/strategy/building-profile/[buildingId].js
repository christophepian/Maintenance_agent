import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  const { buildingId } = req.query;
  await proxyToBackend(req, res, `/strategy/building-profile/${buildingId}`);
}
