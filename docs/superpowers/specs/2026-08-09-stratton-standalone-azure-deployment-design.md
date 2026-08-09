# Stratton standalone Azure deployment design

## Status

Approved design for a cost-minimised, authoritative development deployment of the Stratton Project
Danube demo.

## Deployment target

- Subscription: `MoA-Sub2`
- Subscription ID: `8364fb4d-2d36-4da5-908b-36cb8b808b8c`
- Tenant ID: `27140306-eea5-4e7f-91e9-4c9e86864b3a`
- Deployment identity: `aram@azurelab.nl`
- Environment: `dev`
- Region: `westeurope`
- Resource group: `stratton-demo-rg`
- Cost posture: use the smallest suitable development SKUs and scale-to-zero or auto-pause where
  supported.

Read-only discovery found no application resources in the subscription. The existing demo Bicep
expects shared services that do not exist, so the deployment must add a standalone platform layer
before deploying the current demo-owned resources.

## Goals

1. Deploy a usable Azure-hosted Project Danube demo with realistic Azure integrations.
2. Preserve Phase 5 as the authoritative bundle, review, draft, and model-route evidence service.
3. Expose only the web application publicly and require Microsoft Entra sign-in.
4. Keep the BFF and Phase 5 API internal to the Container Apps environment.
5. Keep Azure SQL private and use Microsoft Entra authentication only.
6. Use managed identities and Azure RBAC for application-to-service access.
7. Use immutable container image digests and fail closed on identity, route, tenant, network,
   migration, or configuration mismatch.
8. Add the approved standalone topology and deployment stages to both existing demo-guide HTML
   editions.

## Non-goals

- Production resilience, multi-region deployment, disaster recovery, or high availability.
- Public access to the BFF, Phase 5 API, database, or administrative endpoints.
- Client secrets, account keys, registry passwords, SQL passwords, or token stores.
- Automatic investment decisions or committee submission.
- Replacing the existing human authority and review boundaries.

## Architecture

### Access boundary

The presenter opens the public HTTPS endpoint of the web Container App. The static browser
application uses MSAL Browser with the authorisation-code flow and PKCE. It requests the BFF
delegated scope and sends exactly one bearer token through the same-origin `/api` proxy.

The BFF Container App has internal ingress only. Container Apps Easy Auth performs the outer
validation, and the BFF independently validates signature, issuer, tenant, expiry, audience,
authorised client application, and delegated scope. The BFF is the Backend for Frontend: it exposes
UI-specific operations, enforces application and governance rules, and prevents the browser from
calling Azure data, AI, messaging, or Phase 5 services directly.

### Authority boundary

The Phase 5 API is an internal Container App. Human operations use delegated On-Behalf-Of tokens.
Bundle completion uses the BFF user-assigned managed identity directly. The BFF application uses a
managed-identity-backed federated assertion for OBO; no client secret or certificate is stored.

Phase 5 remains authoritative for:

- bundle creation and lifecycle;
- authoritative subject versions;
- human reviews;
- draft preparation; and
- approved model-route evidence.

No investment-decision or committee-submission endpoint is added.

### Platform services

The standalone platform provisions:

| Service | Development configuration |
| --- | --- |
| Virtual network | Container Apps infrastructure subnet plus private-endpoint subnet |
| Container Apps environment | VNet-integrated consumption environment |
| Container Registry | Basic SKU with managed-identity pull |
| Log Analytics | Pay-as-you-go with short development retention |
| Azure SQL | General Purpose serverless database with auto-pause, Entra-only authentication, public network disabled, and private endpoint |
| Storage | Standard LRS account and private evidence container |
| Service Bus | Standard namespace and analysis queue |
| Azure AI Search | Basic service and governed evidence index |
| Document Intelligence | Consumption-based account |
| Azure OpenAI | One account in an approved EU region with three separately named governed deployments |
| Container Apps | Public web app; internal BFF and Phase 5 API; minimum replicas set to zero where startup behaviour permits |

The Luna, Terra, and Sol routes use one Azure OpenAI account but retain separate deployment names,
evidence IDs, evidence versions, and Phase 5 route-evidence records. The exact model and minimum
deployment capacity are selected only after provider, regional availability, and quota preflight.

## Identity and access

Three Microsoft Entra applications are required:

1. A public SPA registration for the web application.
2. A BFF API registration exposing `access_as_user`.
3. A Phase 5 API registration exposing its delegated scope and completion application permission.

The deployment identity has authority to create app registrations and grant tenant-wide admin
consent. Entra setup is performed through an idempotent administrative script because the core
resource deployment remains resource-group-scoped Bicep.

The script must:

- configure the exact deployed SPA redirect URI;
- expose the BFF and Phase 5 permissions;
- grant and consent web-to-BFF and BFF-to-Phase 5 delegated access;
- configure the BFF managed-identity federated credential;
- grant the BFF managed identity only the Phase 5 completion application permission; and
- produce non-secret application and permission identifiers for the environment parameter file.

Azure RBAC remains narrowly scoped to the registry, evidence container, Service Bus queue, Search
service, Document Intelligence account, Azure OpenAI account, and required ARM Reader access.

## Infrastructure code changes

The existing `demo-platform/infra/main.bicep` remains the demo application composition layer. A new
standalone entry point provisions the missing platform and supplies its outputs to the existing
modules. The design keeps platform, identity administration, data-plane bootstrap, image build, and
application rollout as separate units so each can be validated and rerun independently.

Expected units:

- standalone platform Bicep;
- network and private SQL module;
- observability and registry module;
- data and messaging module;
- AI services and model deployments module;
- Phase 5 Container App module;
- Entra configuration script;
- ACR image-build script;
- SQL migration and bootstrap script;
- Search index and Phase 5 route-evidence bootstrap script; and
- environment-specific parameter file generated from real deployment outputs.

The existing synthetic `dev.bicepparam` is retained as an example fixture. It is not edited into a
deployable file and is never supplied to Azure.

## Deployment stages

1. **Preflight**
   - Confirm subscription, tenant, deployment identity, region, resource providers, policy, naming,
     SKU availability, Azure OpenAI model availability, and quota.
   - Stop without changes if any mandatory dependency is unavailable.
2. **Entra foundation**
   - Create or reconcile app registrations, permissions, consent, and non-secret identifiers.
3. **Platform provisioning**
   - Create the resource group, network, Container Apps environment, registry, monitoring, private
     SQL, data, messaging, Search, Document Intelligence, and Azure OpenAI resources.
4. **Image build**
   - Build web, BFF, and Phase 5 API images through ACR.
   - Resolve and record immutable SHA-256 digests.
5. **Data-plane bootstrap**
   - Apply Phase 5 and demo SQL migrations through an authorised Entra administrator.
   - Create the Search index.
   - Insert tenant-scoped approved Luna, Terra, and Sol route-evidence records.
6. **Application deployment**
   - Deploy the public web app and internal BFF and Phase 5 apps using real IDs, endpoints, and
     immutable digests.
7. **Verification**
   - Confirm health, identity, private SQL resolution, OBO, completion identity, route authority,
     browser sign-in, and the complete Project Danube scenario.

Every stage is incremental and fail closed. The exact Azure what-if is presented for approval before
resource creation. Destructive operations require separate confirmation.

## Error handling and rollback

- Provider, policy, naming, quota, model availability, or consent failures block deployment before
  dependent stages.
- Bicep uses incremental mode and deterministic names.
- Scripts are idempotent and distinguish already-correct state from conflicting state.
- Placeholder IDs, mutable tags, missing digests, broad RBAC, and secret-bearing settings are
  rejected.
- A failed application revision does not replace the last healthy revision.
- Data migrations are versioned and applied before application activation.
- Route evidence is tenant-scoped, versioned, validity-bound, and compared with live ARM metadata.
- Rollback means activating the prior immutable Container Apps revision. Database rollback is not
  automated; forward-compatible migrations and explicit remediation are required.

## Verification

Before any Azure change:

- run the existing complete local verification;
- compile and lint all Bicep and parameter files;
- validate scripts without emitting secrets; and
- run a read-only provider, policy, quota, and resource inventory.

Before deployment:

- run an Azure what-if;
- verify it contains only the approved resource group and intended resources;
- confirm no deletes and no unrelated modifications; and
- obtain explicit approval.

After deployment:

- verify Container Apps health and revision state;
- verify public web and internal-only backend ingress;
- verify Entra SPA sign-in and the single-bearer proxy;
- verify BFF token validation and Phase 5 OBO;
- verify managed-identity completion;
- verify SQL private connectivity and tenant isolation;
- verify Search, Storage, Service Bus, Document Intelligence, and Azure OpenAI RBAC;
- verify all three route-authority bindings against ARM and Phase 5 evidence; and
- execute the complete Project Danube presenter flow.

## Documentation changes

Update both:

- `Stratton-Demo-Guide.html`
- `Stratton-Demo-Guide-SharePoint.html`

The new section includes the approved topology, the meaning and responsibility of the BFF, target
subscription and region, deployment stages, prerequisites, cost posture, fail-closed controls, and
post-deployment verification. The SharePoint-safe edition must retain its existing no-external-
resource and sandbox-safe constraints.

