/**
 * H3: Shared Next.js API proxy helper.
 * 
 * Ensures all proxy routes correctly forward:
 * - Headers (including Authorization)
 * - Query params unchanged
 * - HTTP status codes as-is
 * - Binary responses (PDF, PNG)
 * 
 * Avoids re-parsing URLs when req.query is already available.
 */

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3001";

/**
 * Forward a request to the backend API with full transparency.
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 * @param path - Backend path (e.g., "/requests", "/invoices/:id/pdf")
 * @param options - Optional overrides
 */
export async function proxyToBackend(req, res, path, options = {}) {
  const {
    method = req.method,
    headers: additionalHeaders = {},
    binary = false, // Set true for PDF/PNG responses
  } = options;

  // H3: Forward all headers, including Authorization
  const forwardHeaders = {
    ...req.headers,
    ...additionalHeaders,
  };
  
  // Remove headers that conflict with the proxied request
  delete forwardHeaders.host;
  delete forwardHeaders.connection;
  delete forwardHeaders['content-length'];  // Let fetch recalculate from actual body

  // When X-Dev-Role is set (dev impersonation), strip any browser-side
  // Authorization token so the backend's dev-identity path is used instead
  // of a potentially mismatched JWT (e.g. manager token on contractor route).
  // In production X-Dev-Role is never set, so real JWTs flow through normally.
  if (additionalHeaders["X-Dev-Role"]) {
    delete forwardHeaders.authorization;
    delete forwardHeaders.Authorization;
  }

  // H3: Preserve query params unchanged (no re-parsing)
  const queryString = req.url?.includes("?") ? req.url.split("?")[1] : "";
  const url = `${API_BASE_URL}${path}${queryString ? `?${queryString}` : ""}`;

  try {
    const fetchOptions = {
      method,
      headers: forwardHeaders,
    };

    // Forward body for POST/PUT/PATCH
    if (method !== "GET" && method !== "HEAD") {
      if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) && !(req.body instanceof require("stream").Readable)) {
        // Parsed JSON body (normal bodyParser: true)
        fetchOptions.body = JSON.stringify(req.body);
        if (!fetchOptions.headers["content-type"]) {
          fetchOptions.headers["content-type"] = "application/json";
        }
      } else if (typeof req.body === "string") {
        fetchOptions.body = req.body;
      } else if (req.readable || (req.body && typeof req.body.pipe === "function")) {
        // Raw stream (bodyParser: false) — collect then forward
        const chunks = [];
        const stream = req.readable ? req : req.body;
        for await (const chunk of stream) {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        }
        fetchOptions.body = Buffer.concat(chunks);
      }
    }

    const backendRes = await fetch(url, fetchOptions);

    // H3: Forward status code as-is
    res.status(backendRes.status);

    // H3: Forward all response headers
    backendRes.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // H3: Handle binary responses (PDF, PNG)
    if (binary || backendRes.headers.get("content-type")?.includes("application/pdf") || backendRes.headers.get("content-type")?.includes("image/png")) {
      const buffer = Buffer.from(await backendRes.arrayBuffer());
      res.send(buffer);
    } else {
      // JSON or text response
      const contentType = backendRes.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const text = await backendRes.text();
        const data = text ? JSON.parse(text) : null;
        res.json(data);
      } else {
        const text = await backendRes.text();
        res.send(text);
      }
    }
  } catch (error) {
    console.error("[proxyToBackend] Error:", error);

    // Detect connection-refused errors and return a clear message
    const isConnRefused = error.code === 'ECONNREFUSED' ||
      (error.cause && error.cause.code === 'ECONNREFUSED') ||
      (error.cause?.cause?.code === 'ECONNREFUSED') ||
      (error.message && error.message.includes('ECONNREFUSED')) ||
      (error.cause?.message?.includes('ECONNREFUSED')) ||
      (error.message && error.message.includes('fetch failed') && !error.message.includes('status'));

    if (isConnRefused) {
      res.status(503).json({
        error: { code: "API_UNAVAILABLE", message: "Backend API is not running. Start it with: cd apps/api && npx tsx src/server.ts" },
      });
    } else {
      res.status(500).json({
        error: { code: "PROXY_ERROR", message: "Failed to proxy request to backend API", details: error.message },
      });
    }
  }
}
