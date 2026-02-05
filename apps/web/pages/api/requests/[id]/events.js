export const config = {
  api: {
    bodyParser: false,
  },
};

async function safeJson(r) {
  const text = await r.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      error: {
        code: "UPSTREAM_NOT_JSON",
        message: "Upstream did not return JSON",
        details: {
          status: r.status,
          contentType: r.headers.get("content-type"),
          bodyPreview: text.slice(0, 200),
        },
      },
    };
  }
}

export default async function handler(req, res) {
  const baseUrl = process.env.API_BASE_URL || "http://127.0.0.1:3001";
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "missing id" });

  let upstreamUrl = `${baseUrl}/requests/${encodeURIComponent(id)}/events`;
  let upstreamInit = {
    method: req.method,
    headers: {
      "content-type": req.headers["content-type"] || "application/json",
    },
  };

  if (req.method === "POST" || req.method === "PUT") {
    // Read raw body and forward as JSON
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    upstreamInit.body = Buffer.concat(chunks).toString();
  }

  try {
    const r = await fetch(upstreamUrl, upstreamInit);
    const j = await safeJson(r);
    return res.status(r.status).json(j);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
