import { proxyToBackend } from "../../../lib/proxy";

export default async function handler(req, res) {
  const { id } = req.query;

  // Build path: /billing-schedules/:id or /billing-schedules/:id/:action
  let backendPath = `/billing-schedules/${id}`;
  if (Array.isArray(id)) {
    const scheduleId = id[0];
    const subAction = id.slice(1).join("/");
    backendPath = `/billing-schedules/${scheduleId}${subAction ? "/" + subAction : ""}`;
  }

  await proxyToBackend(req, res, backendPath);
}
