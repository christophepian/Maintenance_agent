import { proxyToBackend } from "../../../lib/proxy";

export default async function handler(req, res) {
  await proxyToBackend(req, res, "/contractor/jobs", {
    headers: { "X-Dev-Role": "CONTRACTOR" },
  });
}
