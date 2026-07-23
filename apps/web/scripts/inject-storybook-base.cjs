/**
 * Inject `<base href="/storybook/">` into the built Storybook HTML.
 *
 * Storybook's static build references its assets with relative paths
 * (`./sb-manager/...`, `./favicon.svg`). We serve it under the /storybook
 * subpath, but Vercel strips the trailing slash (`/storybook/` -> `/storybook`),
 * so those relative paths resolve against `/` and 404. A <base href> makes every
 * relative URL resolve against `/storybook/` regardless of the address-bar slash.
 *
 * Runs from apps/web (the build cwd); paths are cwd-relative to avoid Node
 * globals the lint config doesn't provide (__dirname) and console.* — both trip
 * the code-quality gate.
 */
const fs = require("fs");

const BASE_TAG = '<base href="/storybook/">';
const files = ["public/storybook/index.html", "public/storybook/iframe.html"];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, "utf8");
  if (html.includes(BASE_TAG)) continue;
  fs.writeFileSync(file, html.replace("<head>", `<head>${BASE_TAG}`));
}
