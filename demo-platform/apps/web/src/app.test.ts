import { describe, expect, it } from "vitest";
import { appTitle } from "./app.js";

describe("appTitle", () => {
  it("uses the expected placeholder title", () => {
    expect(appTitle).toBe("Stratton demo platform");
  });
});
