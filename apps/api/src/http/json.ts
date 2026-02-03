import * as http from "http";

export function sendJson(res: http.ServerResponse, status: number, payload: any) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
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
