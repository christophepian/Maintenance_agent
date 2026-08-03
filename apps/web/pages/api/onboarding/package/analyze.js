import { proxyToBackend } from "../../../../lib/proxy";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  await proxyToBackend(req, res, `/onboarding/package/analyze`);
}
