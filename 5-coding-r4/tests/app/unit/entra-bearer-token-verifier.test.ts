import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { createEntraBearerTokenVerifier } from "../../../app/src/entra-bearer-token-verifier.js";

test("Entra bearer verifier validates signature, issuer, audience, tenant, and application identity", async () => {
  const tenantId = "tenant-a";
  const audience = "phase5-api";
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  const jwksServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ keys: [{ ...jwk, kid: "test-key", alg: "RS256", use: "sig" }] }));
  });
  await new Promise<void>((resolve) => jwksServer.listen(0, resolve));
  const address = jwksServer.address();
  assert.ok(address && typeof address !== "string");
  const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  const verifier = createEntraBearerTokenVerifier({
    tenantId,
    audience,
    jwksUrl: new URL(`http://127.0.0.1:${address.port}/keys`)
  });
  const issue = (tokenAudience: string, scopes?: string) => {
    const encodedHeader = Buffer.from(
      JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT" })
    ).toString("base64url");
    const encodedPayload = Buffer.from(
      JSON.stringify({
      tid: tenantId,
      oid: "service-object-id",
      azp: "bff-managed-identity",
        roles: ["Phase5.Complete"],
      ...(scopes ? { scp: scopes } : {}),
        iss: issuer,
        aud: tokenAudience,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300
      })
    ).toString("base64url");
    const unsigned = `${encodedHeader}.${encodedPayload}`;
    return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url")}`;
  };

  try {
    const principal = await verifier.verify(issue(audience));
    assert.deepEqual(principal, {
      tenantId,
      subjectId: "service-object-id",
      roles: ["Phase5.Complete"],
      identityProvider: issuer,
      authType: "aad",
      isHuman: false,
      applicationId: "bff-managed-identity"
    });
    await assert.rejects(verifier.verify(issue("wrong-audience")));
    const delegatedPrincipal = await verifier.verify(issue(audience, "Phase5.Access"));
    assert.equal(delegatedPrincipal.isHuman, true);
  } finally {
    await new Promise<void>((resolve, reject) =>
      jwksServer.close((error) => (error ? reject(error) : resolve()))
    );
  }
});
