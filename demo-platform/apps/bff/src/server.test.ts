import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./server.js";

describe("createApp", () => {
  it("serves a health endpoint", async () => {
    const response = await request(createApp()).get("/healthz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
