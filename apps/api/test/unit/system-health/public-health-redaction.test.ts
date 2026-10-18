/**
 * Public /api/v1/health stays free of Web memory fields.
 * Run with MONGODB_URI already empty so dotenv cannot point this process at Atlas.
 */
import assert from "node:assert/strict";
import express from "express";
import { createServer, type Server } from "node:http";
import { describe, it } from "node:test";

process.env.NODE_TEST_ENV = "true";
process.env.HU_VERIFICATION_MODE = "true";
process.env.NODE_ENV = "production";
process.env.PLATFORM_MODE = "production";
process.env.MONGODB_URI = "";
process.env.EMAIL_PROVIDER = "mock";

describe("public health redaction", () => {
  it("returns only liveness fields in production", async () => {
    const { default: healthRouter } = await import("../../../src/routes/health.routes.js");
    const app = express();
    app.use("/api/v1/health", healthRouter);
    const server = await new Promise<Server>((resolve) => {
      const created = createServer(app);
      created.listen(0, "127.0.0.1", () => resolve(created));
    });
    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("health test server did not bind");
      }
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/health`);
      const body = (await response.json()) as { data: Record<string, unknown> };
      assert.equal(response.status, 200);
      assert.deepEqual(Object.keys(body.data).sort(), ["liveness", "ready", "status"]);
      const serialized = JSON.stringify(body);
      assert.equal(serialized.includes("rss"), false);
      assert.equal(serialized.includes("heap"), false);
      assert.equal(serialized.includes("instanceId"), false);
      assert.equal(serialized.includes("memory"), false);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
