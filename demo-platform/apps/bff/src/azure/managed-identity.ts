import { ManagedIdentityCredential } from "@azure/identity";

export function createManagedIdentityCredential(
  managedIdentityClientId?: string
): ManagedIdentityCredential {
  return managedIdentityClientId
    ? new ManagedIdentityCredential(managedIdentityClientId)
    : new ManagedIdentityCredential();
}
