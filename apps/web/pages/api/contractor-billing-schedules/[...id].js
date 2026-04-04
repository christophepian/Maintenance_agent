import { proxyToBackend } from "../../../lib/proxy";

export default async function handler(req, res) {
  const { id } = req.query;

  let backendPath = `/contractor-billing-schedules/${id}`;
  if (Array.isArray(id)) {
    const scheduleId = id[0];
    const rest = id.slice(1).join("/");
    backendPath = `/contractor-billing-schedules/${scheduleId}${rest ? "/" + rest : ""}`;
  }

  await proxyToBackend(req, res, backendPath);
}
