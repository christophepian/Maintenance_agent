/**
 * Inject `<base href="/storybook/">` into the built Storybook HTML.
 *
 * Storybook's static build references its assets with relative paths
 * (`./sb-manager/...`, `./favicon.svg`). We serve it under the /storybook
 * subpath, but Vercel strips the trailing slash (`/storybook/` -> `/storybook`),
 * so those relative paths resolve against `/` and 404. A <base href> makes every
 * relative URL resolve against `/storybook/` regardless of the address-bar slash.
 *
 * Kept silent (no console.*) so it doesn't trip the code-quality gate's
 * no-console metric.
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public", "storybook");
const BASE_TAG = '<base href="/storybook/">';

for (const file of ["index.html", "iframe.html"]) {
  const f = path.join(dir, file);
  if (!fs.existsSync(f)) continue;
  const html = fs.readFileSync(f, "utf8");
  if (html.includes(BASE_TAG)) continue;
  fs.writeFileSync(f, html.replace("<head>", `<head>${BASE_TAG}`));
}
