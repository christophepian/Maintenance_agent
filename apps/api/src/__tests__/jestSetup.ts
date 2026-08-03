/**
 * Jest global setup — runs before any test file is loaded.
 *
 * Pins the test-auth env so the suite behaves identically locally and in CI
 * (which has no gitignored .env). startTestServer spawns servers with
 * {...process.env}, so these propagate to the child server processes.
 *  - AUTH_SECRET: tokens created in-process verify against the test server.
 *  - DEV_IDENTITY_ENABLED: contract tests authenticate via the `x-dev-role`
 *    header, which is only honoured when this is "true". Locally it came from
 *    a developer .env; CI has none, so those tests 401'd without this.
 */
process.env.AUTH_SECRET = "test-secret";
process.env.DEV_IDENTITY_ENABLED = "true";
