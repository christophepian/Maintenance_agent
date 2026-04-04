import * as http from "http";

export function sendJson(res: http.ServerResponse, status: number, payload: any) {
  // Stringify BEFORE writing headers so serialization errors (e.g. BigInt)
  // don't leave the response in a half-sent state (headers sent, body empty).
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body);
}

export function sendError(
  res: http.ServerResponse,
  status: number,
  code: string,
  message: string,
  details?: any
) {
  sendJson(res, status, { error: { code, message, details } });
}
