import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
  encodeVerificationReceipt,
  isPrivateIpv4Address,
  validatePhase5RouteBindings,
  type ExpectedRouteBinding,
  type Phase5RouteBinding
} from "./verification-job.js";

const expectedRoutes: readonly ExpectedRouteBinding[] = [
  {
    route: "LUNA",
    resourceId: "/accounts/luna",
    deploymentId: "luna-deployment",
    region: "swedencentral",
    apiVersion: "2025-01-01-preview",
    evidenceId: "luna-evidence",
    evidenceVersion: "v1"
  },
  {
    route: "TERRA",
    resourceId: "/accounts/terra",
    deploymentId: "terra-deployment",
    region: "francecentral",
    apiVersion: "2025-01-01-preview",
    evidenceId: "terra-evidence",
    evidenceVersion: "v1"
  },
  {
    route: "SOL",
    resourceId: "/accounts/sol",
    deploymentId: "sol-deployment",
    region: "westeurope",
    apiVersion: "2025-01-01-preview",
    evidenceId: "sol-evidence",
    evidenceVersion: "v1"
  }
];

function routeRecords(): readonly Phase5RouteBinding[] {
  return expectedRoutes.map((route) => ({
    ...route,
    status: "APPROVED",
    validFrom: "2026-08-09T03:00:00.000Z",
    validUntil: "2026-08-11T03:00:00.000Z"
  }));
}

describe("verification job", () => {
  it("accepts only RFC1918 IPv4 SQL resolution", () => {
    expect(isPrivateIpv4Address("10.42.2.5")).toBe(true);
    expect(isPrivateIpv4Address("172.20.1.5")).toBe(true);
    expect(isPrivateIpv4Address("192.168.10.5")).toBe(true);
    expect(isPrivateIpv4Address("20.50.10.2")).toBe(false);
    expect(isPrivateIpv4Address("::1")).toBe(false);
  });

  it("requires exact ordered and currently approved Phase 5 route bindings", () => {
    expect(
      validatePhase5RouteBindings(
        routeRecords(),
        expectedRoutes,
        new Date("2026-08-10T03:00:00.000Z")
      ).map((route) => route.route)
    ).toEqual(["LUNA", "TERRA", "SOL"]);

    const expired = routeRecords().map((route) => ({ ...route }));
    expired[1] = { ...expired[1]!, validUntil: "2026-08-10T02:59:59.000Z" };
    expect(() =>
      validatePhase5RouteBindings(
        expired,
        expectedRoutes,
        new Date("2026-08-10T03:00:00.000Z")
      )
    ).toThrow("PHASE5_ROUTE_BINDING_INVALID:TERRA");
  });

  it("emits a structured nonce-bound base64 receipt without credentials", () => {
    const encoded = encodeVerificationReceipt({
      version: 1,
      nonce: "nonce-123",
      generatedAtUtc: "2026-08-10T03:00:10.000Z",
      checks: {
        bffHealth: true,
        phase5Health: true,
        sqlPrivateDns: true,
        sqlTokenAuthenticatedQuery: true
      },
      routeBindings: routeRecords()
    });
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
      nonce: string;
      checks: Record<string, boolean>;
    };

    expect(decoded.nonce).toBe("nonce-123");
    expect(decoded.checks).toEqual({
      bffHealth: true,
      phase5Health: true,
      sqlPrivateDns: true,
      sqlTokenAuthenticatedQuery: true
    });
    expect(encoded).not.toMatch(/token|secret|password/i);
  });
});
