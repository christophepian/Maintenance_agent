import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  const { ownerId } = req.query;
  await proxyToBackend(req, res, `/strategy/owner-profile/${ownerId}`);
}
