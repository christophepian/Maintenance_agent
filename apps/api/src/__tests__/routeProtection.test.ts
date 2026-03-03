import { enforceProductionAuthConfig } from "../http/routeProtection";

describe("Route Protection (H1, H2)", () => {
  describe("Production boot guard (H2)", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it("should allow boot when NODE_ENV != production", () => {
      process.env.NODE_ENV = "development";
      process.env.AUTH_OPTIONAL = "true";
      delete process.env.AUTH_SECRET;
      
      expect(() => enforceProductionAuthConfig()).not.toThrow();
    });

    it("should allow boot in production when properly configured", () => {
      process.env.NODE_ENV = "production";
      process.env.AUTH_SECRET = "test-secret-key";
      
      expect(() => enforceProductionAuthConfig()).not.toThrow();
    });

    it("should reject boot when AUTH_SECRET missing in production", () => {
      process.env.NODE_ENV = "production";
      delete process.env.AUTH_SECRET;
      
      expect(() => enforceProductionAuthConfig()).toThrow(/AUTH_SECRET must be set/);
    });
  });

  describe("Route wrapper functionality", () => {
    // Integration tests would go here
    // Testing that withAuthRequired/withRole actually reject unauthenticated requests
    // This would require spinning up a test server with protected routes
    // Deferred to integration test suite
  });
});
