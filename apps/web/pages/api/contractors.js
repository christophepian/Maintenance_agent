export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

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
  try {
    const baseUrl = process.env.API_BASE_URL || "http://127.0.0.1:3001";
    const { id } = req.query;

    if (req.method === "GET") {
      let url = `${baseUrl}/contractors`;
      if (id) url = `${baseUrl}/contractors/${id}`;

      const r = await fetch(url);
      const j = await safeJson(r);
      return res.status(r.status).json(j);
    }

    if (req.method === "POST") {
      const raw = await readRawBody(req);
      let payload = {};
      if (raw && raw.trim()) {
        try {
          payload = JSON.parse(raw);
        } catch (e) {
          return res.status(400).json({ error: "Invalid JSON in request body" });
        }
      }

      const r = await fetch(`${baseUrl}/contractors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await safeJson(r);
      return res.status(r.status).json(j);
    }

    if (req.method === "PATCH") {
      if (!id) return res.status(400).json({ error: "missing id" });

      const raw = await readRawBody(req);
      let payload = {};
      if (raw && raw.trim()) {
        try {
          payload = JSON.parse(raw);
        } catch (e) {
          return res.status(400).json({ error: "Invalid JSON in request body" });
        }
      }

      const r = await fetch(`${baseUrl}/contractors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await safeJson(r);
      return res.status(r.status).json(j);
    }

    if (req.method === "DELETE") {
      if (!id) return res.status(400).json({ error: "missing id" });

      const r = await fetch(`${baseUrl}/contractors/${id}`, { method: "DELETE" });
      const j = await safeJson(r);
      return res.status(r.status).json(j);
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
