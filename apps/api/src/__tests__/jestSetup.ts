/**
 * Jest global setup — runs before any test file is loaded.
 * Sets AUTH_SECRET to match what startTestServer injects into child processes,
 * so tokens created in the test process are valid against the test servers.
 */
process.env.AUTH_SECRET = "test-secret";
