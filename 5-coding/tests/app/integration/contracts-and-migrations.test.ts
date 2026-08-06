import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { implementedOperations } from "../../../app/src/api-runtime.js";
import { approvedOperations } from "../../../app/src/openapi-contract.js";

const appRoot = resolve(process.cwd(), "..", "app");
const migrationPath = resolve(appRoot, "migrations", "001_init.sql");
const repositoryPath = resolve(appRoot, "src", "workload-repository.ts");
const idempotencyPath = resolve(appRoot, "src", "idempotency-store.ts");
const apiRuntimePath = resolve(appRoot, "src", "api-runtime.ts");
const phase3Path = resolve(
  appRoot,
  "..",
  "..",
  "3-azure-design",
  "evidence",
  "stratton-data-api-contracts.json"
);

function operationKey(value: { method: string; path: string; operationId: string; roles: readonly string[] }): string {
  return `${value.operationId}|${value.method}|${value.path}|${[...value.roles].sort().join(",")}`;
}

function parseSchema(sql: string): Map<string, Set<string>> {
  const schema = new Map<string, Set<string>>();
  const lower = sql.toLowerCase();
  const createTablePattern = /create\s+table\s+dbo\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*;/gi;
  for (const match of lower.matchAll(createTablePattern)) {
    const table = match[1] ?? "";
    const body = match[2] ?? "";
    if (!table) {
      continue;
    }
    const columns = schema.get(table) ?? new Set<string>();
    for (const line of body.split(/\r?\n/)) {
      const columnMatch = line.trim().match(/^([a-z0-9_]+)\s+[a-z]/);
      if (columnMatch) {
        const name = columnMatch[1];
        if (name && !name.startsWith("constraint")) {
          columns.add(name);
        }
      }
    }
    schema.set(table, columns);
  }
  const alterAddPattern = /alter\s+table\s+dbo\.([a-z0-9_]+)\s+add\s+([a-z0-9_]+)\s+[a-z]/gi;
  for (const match of lower.matchAll(alterAddPattern)) {
    const table = match[1] ?? "";
    const column = match[2] ?? "";
    if (!table || !column) {
      continue;
    }
    const columns = schema.get(table) ?? new Set<string>();
    columns.add(column);
    schema.set(table, columns);
  }
  return schema;
}

function extractSqlTemplates(source: string): readonly string[] {
  const templates: string[] = [];
  const pattern = /`([\s\S]*?)`/g;
  for (const match of source.matchAll(pattern)) {
    const value = match[1] ?? "";
    if (value.toLowerCase().includes("dbo.")) {
      templates.push(value.toLowerCase());
    }
  }
  return templates;
}

function collectReferencedTables(templates: readonly string[]): Set<string> {
  const tables = new Set<string>();
  for (const template of templates) {
    for (const match of template.matchAll(/dbo\.([a-z0-9_]+)/g)) {
      const table = match[1];
      const index = match.index ?? 0;
      const prefix = template.slice(Math.max(0, index - 8), index);
      if (table && !/\bexec\s*$/i.test(prefix)) {
        tables.add(table);
      }
    }
  }
  return tables;
}

function parseColumnsFromList(list: string): string[] {
  return list
    .split(",")
    .map((item) => item.trim())
    .map((item) => item.replace(/[\[\]\r\n\t]/g, ""))
    .map((item) => item.split(/\s+/)[0] ?? "")
    .map((item) => item.replace(/^@/, ""))
    .filter((item) => /^[a-z0-9_]+$/i.test(item))
    .map((item) => item.toLowerCase());
}

function collectReferencedColumns(templates: readonly string[]): Map<string, Set<string>> {
  const references = new Map<string, Set<string>>();
  const add = (table: string, columns: readonly string[]): void => {
    const existing = references.get(table) ?? new Set<string>();
    for (const column of columns) {
      existing.add(column);
    }
    references.set(table, existing);
  };
  for (const template of templates) {
    for (const match of template.matchAll(/insert\s+into\s+dbo\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*values/gi)) {
      const table = match[1] ?? "";
      const list = match[2] ?? "";
      if (table) {
        add(table, parseColumnsFromList(list));
      }
    }
    for (const match of template.matchAll(/update\s+dbo\.([a-z0-9_]+)\s+set\s+([\s\S]*?)where/gi)) {
      const table = match[1] ?? "";
      const setList = match[2] ?? "";
      if (!table) {
        continue;
      }
      const cols = setList
        .split(",")
        .map((entry) => entry.trim())
        .map((entry) => entry.split("=")[0]?.trim() ?? "")
        .map((entry) => entry.split(".").at(-1) ?? "")
        .filter((entry) => /^[a-z0-9_]+$/i.test(entry))
        .map((entry) => entry.toLowerCase());
      add(table, cols);
    }
    for (const match of template.matchAll(/merge\s+dbo\.([a-z0-9_]+)[\s\S]*?when\s+matched\s+then\s+update\s+set\s+([\s\S]*?)(when\s+not\s+matched|;)/gi)) {
      const table = match[1] ?? "";
      const setList = match[2] ?? "";
      if (!table) {
        continue;
      }
      const cols = setList
        .split(",")
        .map((entry) => entry.trim())
        .map((entry) => entry.split("=")[0]?.trim() ?? "")
        .map((entry) => entry.split(".").at(-1) ?? "")
        .filter((entry) => /^[a-z0-9_]+$/i.test(entry))
        .map((entry) => entry.toLowerCase());
      add(table, cols);
    }
    for (const match of template.matchAll(/merge\s+dbo\.([a-z0-9_]+)[\s\S]*?insert\s*\(([\s\S]*?)\)\s*values/gi)) {
      const table = match[1] ?? "";
      const list = match[2] ?? "";
      if (table) {
        add(table, parseColumnsFromList(list));
      }
    }
    for (const match of template.matchAll(/select\s+([\s\S]*?)\s+from\s+dbo\.([a-z0-9_]+)/gi)) {
      const selectList = match[1] ?? "";
      const table = match[2] ?? "";
      if (!table || selectList.includes("*")) {
        continue;
      }
      const cols = selectList
        .split(",")
        .map((entry) => entry.trim())
        .map((entry) => entry.split(/\s+as\s+/i)[0] ?? "")
        .map((entry) => entry.split(".").at(-1) ?? "")
        .filter((entry) => /^[a-z][a-z0-9_]*$/i.test(entry))
        .map((entry) => entry.toLowerCase());
      add(table, cols);
    }
  }
  return references;
}

function parseGrants(sql: string): Map<string, Map<string, Set<string>>> {
  const grants = new Map<string, Map<string, Set<string>>>();
  const pattern = /grant\s+([a-z,\s]+)\s+on\s+dbo\.([a-z0-9_]+)\s+to\s+([a-z0-9_]+)\s*;/gi;
  for (const match of sql.toLowerCase().matchAll(pattern)) {
    const opsRaw = match[1] ?? "";
    const table = match[2] ?? "";
    const role = match[3] ?? "";
    if (!table || !role) {
      continue;
    }
    const roleMap = grants.get(role) ?? new Map<string, Set<string>>();
    const current = roleMap.get(table) ?? new Set<string>();
    for (const op of opsRaw.split(",").map((value) => value.trim()).filter((value) => value.length > 0)) {
      current.add(op);
    }
    roleMap.set(table, current);
    grants.set(role, roleMap);
  }
  return grants;
}

test("api runtime operation path-role parity matches phase 3 contract", () => {
  const phase3 = JSON.parse(readFileSync(phase3Path, "utf8")) as {
    apis: Array<{ operationId: string; method: string; path: string; roles: string[] }>;
  };
  const expected = new Set(phase3.apis.map((item) => operationKey(item)));
  const runtime = new Set(implementedOperations.map((item) => operationKey(item)));
  const openapi = new Set(approvedOperations.map((item) => operationKey(item)));
  assert.deepEqual(runtime, expected);
  assert.deepEqual(openapi, expected);
});

test("openapi contains exact approved operations and role sets", () => {
  const openapiRaw = readFileSync(resolve(appRoot, "openapi", "stratton-openapi-3.1.yaml"), "utf8");
  assert.equal(openapiRaw.includes("openapi: 3.1.0"), true);
  const found = new Set<string>();
  const lines = openapiRaw.split(/\r?\n/);
  let activePath = "";
  let activeMethod = "";
  let activeOperationId = "";
  let activeRoles: string[] = [];
  const flush = () => {
    if (activePath && activeMethod && activeOperationId) {
      found.add(
        operationKey({
          operationId: activeOperationId,
          method: activeMethod.toUpperCase(),
          path: activePath,
          roles: activeRoles
        })
      );
    }
    activeMethod = "";
    activeOperationId = "";
    activeRoles = [];
  };
  for (const line of lines) {
    if (/^  \//.test(line)) {
      flush();
      activePath = line.trim().slice(0, -1);
      continue;
    }
    const methodMatch = line.match(/^    (get|post):\s*$/i);
    if (methodMatch) {
      flush();
      activeMethod = methodMatch[1] ?? "";
      continue;
    }
    const operationMatch = line.match(/^\s+operationId:\s*(\S+)\s*$/);
    if (operationMatch) {
      activeOperationId = operationMatch[1] ?? "";
      continue;
    }
    const rolesMatch = line.match(/^\s+x-required-roles:\s*\[(.*)\]\s*$/);
    if (rolesMatch) {
      activeRoles = rolesMatch[1]
        ?.split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0) ?? [];
      continue;
    }
  }
  flush();
  assert.deepEqual(found, new Set(approvedOperations.map((item) => operationKey(item))));
});

test("migration and repository SQL contract is schema-consistent", () => {
  const migration = readFileSync(migrationPath, "utf8");
  const schema = parseSchema(migration);
  const repositorySql = extractSqlTemplates(readFileSync(repositoryPath, "utf8"));
  const idempotencySql = extractSqlTemplates(readFileSync(idempotencyPath, "utf8"));
  const templates = [...repositorySql, ...idempotencySql];
  const tables = collectReferencedTables(templates);
  for (const table of tables) {
    assert.equal(schema.has(table), true, `missing table ${table}`);
  }
  const referencedColumns = collectReferencedColumns(templates);
  for (const [table, columns] of referencedColumns.entries()) {
    const tableColumns = schema.get(table) ?? new Set<string>();
    for (const column of columns) {
      assert.equal(tableColumns.has(column), true, `missing column ${table}.${column}`);
    }
  }
  for (const required of [
    "idempotency_records.claim_id",
    "work_items.evidence_id",
    "work_items.evidence_version_id",
    "work_items.analysis_run_id",
    "audit_outbox.source_event_id",
    "queue_outbox.canonical_body",
    "queue_outbox.next_attempt_at"
  ]) {
    const [table, column] = required.split(".");
    assert.equal((schema.get(table ?? "") ?? new Set<string>()).has(column ?? ""), true, required);
  }
  assert.equal(schema.has("extraction_chunks"), true);
});

test("role grant matrix satisfies repository operations with least privilege", () => {
  const sql = readFileSync(migrationPath, "utf8").toLowerCase();
  const grants = parseGrants(sql);
  const requireOps = (role: string, table: string, ops: readonly string[]) => {
    const roleMap = grants.get(role) ?? new Map<string, Set<string>>();
    const tableOps = roleMap.get(table) ?? new Set<string>();
    for (const op of ops) {
      assert.equal(tableOps.has(op), true, `${role}.${table}.${op}`);
    }
  };

  requireOps("workload_api_role", "case_rollout_control", ["select", "insert"]);
  requireOps("workload_api_role", "evidence_objects", ["select"]);
  requireOps("workload_api_role", "work_items", ["select", "insert", "update"]);
  requireOps("workload_api_role", "queue_outbox", ["select", "insert", "update"]);

  requireOps("worker_runtime_role", "eligibility_decisions", ["select"]);
  requireOps("worker_runtime_role", "external_licence_decisions", ["select"]);
  requireOps("worker_runtime_role", "evidence_objects", ["select", "insert"]);
  requireOps("worker_runtime_role", "citations", ["delete"]);
  requireOps("worker_runtime_role", "queue_outbox", ["select", "insert", "update"]);
  requireOps("audit_export_role", "queue_outbox", ["select", "update"]);
  const relayRoleMap = grants.get("queue_outbox_relay_role") ?? new Map<string, Set<string>>();
  assert.equal((relayRoleMap.get("queue_outbox")?.size ?? 0) === 0, true);
  assert.match(sql, /create role queue_outbox_relay_role authorization dbo/i);
  assert.match(sql, /grant execute on dbo\.usp_list_pending_queue_outbox_scopes to queue_outbox_relay_role/i);

  for (const forbidden of [
    "alter role db_owner add member workload_api_role",
    "alter role db_owner add member worker_runtime_role",
    "alter role db_owner add member audit_export_role",
    "role owner",
    "role contributor"
  ]) {
    assert.equal(sql.includes(forbidden), false, forbidden);
  }
});

test("queue outbox recovery SQL/RLS contract stays relay-scoped and autonomous", () => {
  const migration = readFileSync(migrationPath, "utf8");
  assert.match(migration, /create or alter function rls\.fn_queue_outbox_access/i);
  assert.match(migration, /user_name\(\)\s*=\s*n''queue_outbox_relay_executor''/i);
  assert.match(migration, /session_context\(n''queue_outbox_relay_proc''\)/i);
  assert.equal(/is_rolemember\(n''queue_outbox_relay_role''\)\s*=\s*1/i.test(migration), false);
  assert.match(migration, /session_context\(n''allow_tenant_lookup''\)/i);
  assert.equal(/session_context\(n''outbox_relay''\)/i.test(migration), false);
  assert.match(migration, /add filter predicate rls\.fn_queue_outbox_access\(tenant_id, case_id\) on dbo\.queue_outbox/i);
  assert.match(
    migration,
    /add block predicate rls\.fn_tenant_case\(tenant_id, case_id\) on dbo\.queue_outbox after insert/i
  );
  assert.match(
    migration,
    /add block predicate rls\.fn_tenant_case\(tenant_id, case_id\) on dbo\.queue_outbox after update/i
  );
  assert.match(migration, /create or alter procedure dbo\.usp_list_pending_queue_outbox_scopes/i);
  assert.match(migration, /create user queue_outbox_relay_executor without login/i);
  assert.match(
    migration,
    /create or alter procedure dbo\.usp_list_pending_queue_outbox_scopes[\s\S]*with execute as 'queue_outbox_relay_executor'/i
  );
  assert.match(
    migration,
    /usp_list_pending_queue_outbox_scopes[\s\S]*sp_set_session_context @key=n'queue_outbox_relay_proc', @value=1/i
  );
  assert.match(
    migration,
    /usp_list_pending_queue_outbox_scopes[\s\S]*begin catch[\s\S]*sp_set_session_context @key=n'queue_outbox_relay_proc', @value=null/i
  );
  assert.match(migration, /grant execute on dbo\.usp_list_pending_queue_outbox_scopes to queue_outbox_relay_role/i);
  assert.equal(
    /grant execute on dbo\.usp_list_pending_queue_outbox_scopes to (workload_api_role|worker_runtime_role|audit_export_role)/i.test(
      migration
    ),
    false
  );
  assert.equal(
    /grant impersonate on user::queue_outbox_relay_executor to (workload_api_role|worker_runtime_role|audit_export_role|queue_outbox_relay_role)/i.test(
      migration
    ),
    false
  );

  const repositorySource = readFileSync(repositoryPath, "utf8");
  assert.match(repositorySource, /listPendingQueueOutboxScopes/);
  assert.match(repositorySource, /exec\s+dbo\.usp_list_pending_queue_outbox_scopes/i);
  assert.equal(repositorySource.includes("__outbox-relay__"), false);
  assert.equal(repositorySource.includes("outboxRelay"), false);

  const apiRuntimeSource = readFileSync(apiRuntimePath, "utf8");
  assert.match(apiRuntimeSource, /dispatchPendingAcrossScopes\(\s*100,\s*50\s*\)/);
  assert.equal(/dispatchPending\(\s*50\s*\)/.test(apiRuntimeSource), false);
});
