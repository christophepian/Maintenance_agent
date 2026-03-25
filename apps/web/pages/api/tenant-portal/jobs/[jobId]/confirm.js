import { proxyToBackend } from "../../../../../lib/proxy";

export default async function handler(req, res) {
  const { jobId } = req.query;
  await proxyToBackend(req, res, `/tenant-portal/jobs/${jobId}/confirm`);
}
