import { proxyToBackend } from "../../../lib/proxy";

export const config = {
  api: {
    bodyParser: false, // Required for multipart/attachment uploads
  },
};

export default async function handler(req, res) {
  const { id } = req.query;

  // Build path: /rental-applications/:id or /rental-applications/:id/:action
  let backendPath = `/rental-applications/${id}`;
  if (Array.isArray(id)) {
    const appId = id[0];
    const subAction = id.slice(1).join("/");
    backendPath = `/rental-applications/${appId}${subAction ? "/" + subAction : ""}`;
  }

  await proxyToBackend(req, res, backendPath);
}
