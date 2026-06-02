import { proxyToBackend } from "../../../lib/proxy";

export default async function handler(req, res) {
  if (process.env.NEXT_PUBLIC_SANDBOX !== "true") {
    return res.status(403).json({ error: "Sandbox mode is not enabled" });
  }
  await proxyToBackend(req, res, "/sandbox/seed");
}
