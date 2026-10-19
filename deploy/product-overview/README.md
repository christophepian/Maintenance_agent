# Standalone product-overview deployment

A self-contained, password-gated copy of the product overview page. Separate
Vercel project — nothing here touches the app, and the app's `/docs/*` gate
(Supabase session + `accessLevel: ADMIN`) does not apply.

```
index.html        the page (EN/FR, responsive) — no docs hub bar
screenshots/      the three product screenshots it references
middleware.js     password form + cookie gate on SITE_PASSWORD, fails closed
vercel.json       static project, no build step, noindex headers
```

## Deploy

From this directory, with the Vercel CLI:

```bash
npx vercel login
npx vercel link            # create/select a NEW project — do not reuse the app's
npx vercel env add SITE_PASSWORD production    # paste the shared password
npx vercel --prod
```

`vercel link` must create a project whose **root directory is this folder**, so
the repo-root `vercel.json` (which only builds the `sandbox` branch) does not
apply.

## Sharing

Send the deployment URL and the password separately. Visitors get a password
form; on success a cookie (the SHA-256 of the password, never the password)
keeps them in for 30 days.

Note: this is a form and not HTTP Basic Auth because Vercel strips the
`WWW-Authenticate` header from Edge Middleware responses — a browser given a
401 then has nothing to prompt with and just renders the body as text.

## Rotating the password

```bash
npx vercel env rm SITE_PASSWORD production
npx vercel env add SITE_PASSWORD production
npx vercel --prod          # redeploy so the new value is picked up
```

Anyone still holding the old password loses access at that point: the cookie
carries a hash of the old password and stops matching immediately.

## Updating the page

The source of truth is `docs/product-overview.html` at the repo root. To refresh
this copy, re-run the extraction that produced `index.html`: strip the
`#hub-bar` style/div/script and the `body{padding-top:36px}` override, then copy
`docs/screenshots/` across. Everything else is byte-identical.
