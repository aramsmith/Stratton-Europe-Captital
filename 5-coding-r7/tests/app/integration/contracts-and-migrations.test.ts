import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { implementedOperations } from "../../../app/src/api-runtime.js";
import { approvedOperations } from "../../../app/src/openapi-contract.js";
import type { SqlExecutor } from "../../../app/src/sql-client.js";
import { SqlWorkloadRepository } from "../../../app/src/workload-repository.js";

const appRoot = resolve(process.cwd(), "..", "app");
const ts: any = createRequire(resolve(appRoot, "package.json"))("typescript");
const migrationPath = resolve(appRoot, "migrations", "001_init.sql");
const routingMigrationPath = resolve(appRoot, "migrations", "002_model_routing.sql");
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
const cc002RoutingPath = resolve(
  appRoot,
  "..",
  "..",
  "3-azure-design",
  "evidence",
  "stratton-model-routing-contract-cc-002-r2-proposed.json"
);

function operationKey(value: { method: string; path: string; operationId: string; roles: readonly string[] }): string {
  return `${value.operationId}|${value.method}|${value.path}|${[...value.roles].sort().join(",")}`;
}

function stripSqlNoise(sql: string): string {
  let output = "";
  let index = 0;
  while (index < sql.length) {
    const current = sql[index] ?? "";
    const next = sql[index + 1] ?? "";
    if (current === "-" && next === "-") {
      while (index < sql.length && (sql[index] ?? "") !== "\n") {
        output += " ";
        index += 1;
      }
      continue;
    }
    if (current === "/" && next === "*") {
      output += "  ";
      index += 2;
      while (index < sql.length) {
        const nestedCurrent = sql[index] ?? "";
        const nestedNext = sql[index + 1] ?? "";
        if (nestedCurrent === "*" && nestedNext === "/") {
          output += "  ";
          index += 2;
          break;
        }
        output += nestedCurrent === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }
    if (current === "'" || current === '"') {
      const delimiter = current;
      output += " ";
      index += 1;
      while (index < sql.length) {
        const stringCurrent = sql[index] ?? "";
        const stringNext = sql[index + 1] ?? "";
        if (stringCurrent === delimiter && stringNext === delimiter) {
          output += "  ";
          index += 2;
          continue;
        }
        output += stringCurrent === "\n" ? "\n" : " ";
        index += 1;
        if (stringCurrent === delimiter) {
          break;
        }
      }
      continue;
    }
    output += current;
    index += 1;
  }
  return output;
}

function splitSqlDefinitions(value: string): readonly string[] {
  const definitions: string[] = [];
  let current = "";
  let parentheses = 0;
  let bracketQuoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? "";
    const next = value[index + 1] ?? "";
    if (bracketQuoted) {
      current += character;
      if (character === "]" && next === "]") {
        current += next;
        index += 1;
      } else if (character === "]") {
        bracketQuoted = false;
      }
      continue;
    }
    if (character === "[") {
      bracketQuoted = true;
      current += character;
      continue;
    }
    if (character === "(") {
      parentheses += 1;
    } else if (character === ")" && parentheses > 0) {
      parentheses -= 1;
    }
    if (character === "," && parentheses === 0) {
      definitions.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim().length > 0) {
    definitions.push(current);
  }
  return definitions;
}

function sqlIdentifier(value: string): string | undefined {
  const text = value.trim();
  if (!text) {
    return undefined;
  }
  if (text[0] === "[") {
    let name = "";
    let index = 1;
    while (index < text.length) {
      const character = text[index] ?? "";
      const next = text[index + 1] ?? "";
      if (character === "]" && next === "]") {
        name += "]";
        index += 2;
        continue;
      }
      if (character === "]") {
        index += 1;
        return index === text.length || /\s/.test(text[index] ?? "") ? name : undefined;
      }
      name += character;
      index += 1;
    }
    return undefined;
  }
  let index = 0;
  if (!/[a-z_]/i.test(text[index] ?? "")) {
    return undefined;
  }
  const start = index;
  index += 1;
  while (/[a-z0-9_@$#]/i.test(text[index] ?? "")) {
    index += 1;
  }
  return index === text.length || /\s/.test(text[index] ?? "")
    ? text.slice(start, index)
    : undefined;
}

function sqlParameterIdentifier(value: string): string | undefined {
  const text = value.trim();
  return text.startsWith("@") ? sqlIdentifier(text.slice(1)) : undefined;
}

function isInsideBracketIdentifier(source: string, position: number): boolean {
  let bracketQuoted = false;
  for (let index = 0; index < position; index += 1) {
    const current = source[index] ?? "";
    const next = source[index + 1] ?? "";
    if (!bracketQuoted && current === "[") {
      bracketQuoted = true;
      continue;
    }
    if (bracketQuoted && current === "]" && next === "]") {
      index += 1;
      continue;
    }
    if (bracketQuoted && current === "]") {
      bracketQuoted = false;
    }
  }
  return bracketQuoted;
}

function parseSchema(sql: string): Map<string, Set<string>> {
  const schema = new Map<string, Set<string>>();
  const lower = stripSqlNoise(sql).toLowerCase();
  const createTablePattern = /create\s+table\s+dbo\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*;/gi;
  for (const match of lower.matchAll(createTablePattern)) {
    if (isInsideBracketIdentifier(lower, match.index ?? 0)) {
      continue;
    }
    const table = match[1] ?? "";
    const body = match[2] ?? "";
    if (!table) {
      continue;
    }
    const columns = schema.get(table) ?? new Set<string>();
    for (const line of body.split(/\r?\n/)) {
      const rawColumn = sqlIdentifier(line);
      const name =
        rawColumn && (line.trim().startsWith("[") || /^[a-z_][a-z0-9_]*$/i.test(rawColumn))
          ? rawColumn
          : undefined;
      if (name) {
        if (name && !name.startsWith("constraint")) {
          columns.add(name);
        }
      }
    }
    schema.set(table, columns);
  }
  const alterAddPattern = /alter\s+table\s+dbo\.([a-z0-9_]+)\s+add\b\s*([\s\S]*?)(?:;|$)/gi;
  for (const match of lower.matchAll(alterAddPattern)) {
    if (isInsideBracketIdentifier(lower, match.index ?? 0)) {
      continue;
    }
    const table = match[1] ?? "";
    const definitions = match[2] ?? "";
    if (!table || !definitions) {
      continue;
    }
    const columns = schema.get(table) ?? new Set<string>();
    for (const definition of splitSqlDefinitions(definitions)) {
      const rawColumn = sqlIdentifier(definition);
      const column =
        rawColumn &&
        (definition.trim().startsWith("[") || /^[a-z_][a-z0-9_]*$/i.test(rawColumn))
          ? rawColumn
          : undefined;
      if (column) {
        columns.add(column);
      }
    }
    schema.set(table, columns);
  }
  return schema;
}

function completeSqlIdentifier(value: string): string | undefined {
  const text = value.trim();
  const identifier = sqlIdentifier(text);
  if (!identifier) {
    return undefined;
  }
  if (text[0] === "[") {
    let index = 1;
    while (index < text.length) {
      const character = text[index] ?? "";
      const next = text[index + 1] ?? "";
      if (character === "]" && next === "]") {
        index += 2;
        continue;
      }
      if (character === "]") {
        return text.slice(index + 1).trim().length === 0 ? identifier : undefined;
      }
      index += 1;
    }
    return undefined;
  }
  let index = 1;
  while (/[a-z0-9_@$#]/i.test(text[index] ?? "")) {
    index += 1;
  }
  return text.slice(index).trim().length === 0 ? identifier : undefined;
}

function droppedAnalysisRunColumns(sql: string): Set<string> {
  const columns = new Set<string>();
  const source = stripSqlNoise(sql);
  const dropColumnPattern = /\balter\s+table\s+dbo\.analysis_runs\s+drop\s+column\b\s*([\s\S]*?)(?:;|$)/gi;
  for (const match of source.matchAll(dropColumnPattern)) {
    if (isInsideBracketIdentifier(source, match.index ?? 0)) {
      continue;
    }
    for (const definition of splitSqlDefinitions(match[1] ?? "")) {
      const column = completeSqlIdentifier(definition);
      if (column) {
        columns.add(column.toLowerCase());
      }
    }
  }
  return columns;
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

function parseColumnsFromList(list: string, parameters = false): string[] {
  return splitSqlDefinitions(stripSqlNoise(list))
    .map((item) => (parameters ? sqlParameterIdentifier(item) : sqlIdentifier(item)))
    .filter((item): item is string => Boolean(item))
    .filter((item) => /^[a-z0-9_]+$/i.test(item))
    .map((item) => item.toLowerCase());
}

const routingColumnMappings = [
  ["modelTaskClass", "model_task_class"],
  ["modelTier", "model_tier"],
  ["modelRouteReason", "model_route_reason"],
  ["modelReasoningEffort", "model_reasoning_effort"],
  ["modelRoutingPolicyVersion", "model_routing_policy_version"],
  ["deploymentResidencyEvidenceId", "deployment_residency_evidence_id"],
  ["modelName", "model_name"],
  ["modelVersion", "model_version"],
  ["modelValidationStatus", "model_validation_status"],
  ["modelLatencyMilliseconds", "model_latency_milliseconds"],
  ["modelInputTokens", "model_input_tokens"],
  ["modelOutputTokens", "model_output_tokens"],
  ["modelObservedCostUsd", "model_observed_cost_usd"]
] as const;

function sourceFile(source: string): any {
  return ts.createSourceFile("workload-repository.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function findSqlRepositoryMethod(
  source: any,
  methodName: "createAnalysisRun" | "getAnalysisRun"
): any | undefined {
  for (const statement of source.statements) {
    if (
      ts.isClassDeclaration(statement) &&
      statement.name?.text === "SqlWorkloadRepository"
    ) {
      return statement.members.find(
        (member: any): member is any =>
          ts.isMethodDeclaration(member) && member.name.getText(source) === methodName
      );
    }
  }
  return undefined;
}

function stringValue(node: any | undefined): string | undefined {
  if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
    return node.text;
  }
  return undefined;
}

function findRepositoryCall(
  method: any,
  operation: "execute" | "queryMany"
): any | undefined {
  let found: any | undefined;
  const visit = (node: any): void => {
    if (found) {
      return;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === operation &&
      (stringValue(node.arguments[0]) ?? "").toLowerCase().includes("dbo.analysis_runs")
    ) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(method, visit);
  return found;
}

function objectProperty(
  source: any,
  object: any,
  name: string
): any | undefined {
  return object.properties.find(
    (property: any): property is any =>
      ts.isPropertyAssignment(property) && property.name.getText(source).replace(/[\[\]"']/g, "") === name
  );
}

function containsObjectPropertyMapping(
  source: any,
  root: any,
  propertyName: string,
  objectName: string,
  sourcePropertyName: string
): boolean {
  let found = false;
  const visit = (node: any): void => {
    if (
      !found &&
      ts.isPropertyAssignment(node) &&
      node.name.getText(source).replace(/[\[\]"']/g, "") === propertyName &&
      propertyAccess(node.initializer, objectName, sourcePropertyName)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

function propertyAccess(
  expression: any,
  objectName: string,
  propertyName: string
): boolean {
  return (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === objectName &&
    expression.name.text === propertyName
  );
}

function topLevelReturnedObject(method: any): any | undefined {
  let result: any | undefined;
  const visit = (node: any): void => {
    if (result) {
      return;
    }
    if (node !== method && ts.isFunctionLike(node)) {
      return;
    }
    if (ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(node.expression)) {
      result = node.expression;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(method, visit);
  return result;
}

function insertColumnParameters(sql: string): Map<string, string> {
  const mappings = new Map<string, string>();
  const match = stripSqlNoise(sql).match(
    /insert\s+into\s+dbo\.analysis_runs\s*\(([\s\S]*?)\)\s*values\s*\(([\s\S]*?)\)/i
  );
  if (!match) {
    return mappings;
  }
  const columns = parseColumnsFromList(match[1] ?? "");
  const parameters = parseColumnsFromList(match[2] ?? "", true);
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index];
    const parameter = parameters[index];
    if (column && parameter) {
      mappings.set(column, parameter);
    }
  }
  return mappings;
}

function selectColumns(sql: string): Set<string> {
  const match = stripSqlNoise(sql).match(/select\s+([\s\S]*?)\s+from\s+dbo\.analysis_runs\b/i);
  return new Set(parseColumnsFromList(match?.[1] ?? ""));
}

function validateAnalysisRunPersistence(source: string): readonly string[] {
  const findings: string[] = [];
  const parsed = sourceFile(source);
  const create = findSqlRepositoryMethod(parsed, "createAnalysisRun");
  const get = findSqlRepositoryMethod(parsed, "getAnalysisRun");
  if (!create || !get) {
    return ["SqlWorkloadRepository must define createAnalysisRun and getAnalysisRun"];
  }
  const insert = findRepositoryCall(create, "execute");
  const select = findRepositoryCall(get, "queryMany");
  if (!insert || !select) {
    return ["analysis-run persistence must use repository-bound dbo.analysis_runs SQL calls"];
  }
  const parameterObject = insert.arguments[1];
  const parameters = parameterObject && ts.isObjectLiteralExpression(parameterObject) ? parameterObject : undefined;
  const rowObject = topLevelReturnedObject(get);
  const parameterMapping = insertColumnParameters(stringValue(insert.arguments[0]) ?? "");
  const selected = selectColumns(stringValue(select.arguments[0]) ?? "");

  for (const [property, column] of routingColumnMappings) {
    if (parameterMapping.get(column) !== column) {
      findings.push(`INSERT must bind ${column} to @${column} by position`);
    }
    const parameter = parameters && objectProperty(parsed, parameters, column);
    if (!parameter || !propertyAccess(parameter.initializer, "record", property)) {
      findings.push(`INSERT ${column} must receive record.${property}`);
    }
    if (!selected.has(column)) {
      findings.push(`SELECT must retrieve ${column}`);
    }
    if (!rowObject || !containsObjectPropertyMapping(parsed, rowObject, property, "row", column)) {
      findings.push(`SELECT ${column} must map to ${property}`);
    }
  }
  return findings;
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
  const cc002Routing = JSON.parse(readFileSync(cc002RoutingPath, "utf8")) as {
    changeControlId: string;
    recordType: string;
  };
  assert.equal(cc002Routing.changeControlId, "STRATTON-CC-002");
  assert.equal(cc002Routing.recordType, "STRATTON_DETERMINISTIC_MODEL_ROUTING_CONTRACT");
  const phase3ByOperation = new Map(phase3.apis.map((item) => [item.operationId, item]));
  const expectedEscalationRoles = [
    "ComplianceApprover",
    "DealContributor",
    "DealReviewer",
    "LegalApprover",
    "ValidationProducer"
  ];
  for (const runtimeOperation of implementedOperations) {
    const phase3Operation = phase3ByOperation.get(runtimeOperation.operationId);
    assert.ok(phase3Operation, runtimeOperation.operationId);
    assert.equal(runtimeOperation.method, phase3Operation.method, runtimeOperation.operationId);
    assert.equal(runtimeOperation.path, phase3Operation.path, runtimeOperation.operationId);
    if (runtimeOperation.operationId === "requestAnalysis") {
      assert.deepEqual(phase3Operation.roles, ["DealContributor"]);
    }
    assert.deepEqual(
      [...runtimeOperation.roles].sort(),
      runtimeOperation.operationId === "requestAnalysis"
        ? expectedEscalationRoles
        : [...phase3Operation.roles].sort(),
      runtimeOperation.operationId
    );
  }
  assert.equal(implementedOperations.length, phase3.apis.length);
  const runtime = new Set(implementedOperations.map((item) => operationKey(item)));
  const openapi = new Set(approvedOperations.map((item) => operationKey(item)));
  assert.deepEqual(openapi, runtime);
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
  const migrations = [
    readFileSync(migrationPath, "utf8"),
    readFileSync(routingMigrationPath, "utf8")
  ];
  const schema = parseSchema(migrations.join("\n"));
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

test("model routing migration preserves historic route evidence and adds every routing column", () => {
  const baselineMigration = readFileSync(migrationPath, "utf8");
  const routingMigration = readFileSync(routingMigrationPath, "utf8");
  const schema = parseSchema(`${baselineMigration}\n${routingMigration}`);
  const analysisRunColumns = schema.get("analysis_runs") ?? new Set<string>();
  for (const column of [
    "model_task_class",
    "model_tier",
    "model_route_reason",
    "model_reasoning_effort",
    "model_routing_policy_version",
    "deployment_residency_evidence_id",
    "model_name",
    "model_version",
    "model_validation_status",
    "model_latency_milliseconds",
    "model_input_tokens",
    "model_output_tokens",
    "model_observed_cost_usd",
    "regional_deployment_evidence_id"
  ]) {
    assert.equal(analysisRunColumns.has(column), true, `analysis_runs.${column}`);
  }
  assert.equal(
    droppedAnalysisRunColumns(routingMigration).has("regional_deployment_evidence_id"),
    false,
    "regional_deployment_evidence_id must remain for historical records"
  );
});

test("routing migration historical DROP COLUMN protection recognises quoted and multi-column drops", () => {
  const historical = "ALTER TABLE dbo.analysis_runs DROP COLUMN [regional_deployment_evidence_id];";
  const escapedNonmatching = "ALTER TABLE dbo.analysis_runs DROP COLUMN [regional_deployment_evidence_id]]note];";
  const multiple = "ALTER TABLE dbo.analysis_runs DROP COLUMN obsolete_route, [regional_deployment_evidence_id];";
  const decoys = `
    -- ALTER TABLE dbo.analysis_runs DROP COLUMN [regional_deployment_evidence_id];
    SELECT 'ALTER TABLE dbo.analysis_runs DROP COLUMN regional_deployment_evidence_id;';
    SELECT [ALTER TABLE dbo.analysis_runs DROP COLUMN regional_deployment_evidence_id];
  `;
  assert.equal(
    droppedAnalysisRunColumns(historical).has("regional_deployment_evidence_id"),
    true,
    "bracket-quoted historical drop"
  );
  assert.equal(
    droppedAnalysisRunColumns(escapedNonmatching).has("regional_deployment_evidence_id"),
    false,
    "escaped bracket nonmatching drop"
  );
  assert.equal(
    droppedAnalysisRunColumns(multiple).has("regional_deployment_evidence_id"),
    true,
    "multiple drops containing historical column"
  );
  assert.equal(
    droppedAnalysisRunColumns(decoys).has("regional_deployment_evidence_id"),
    false,
    "comment and string decoys"
  );
});

test("analysis run repository SQL persists and retrieves application-owned route evidence", () => {
  const repositorySource = readFileSync(repositoryPath, "utf8");
  assert.deepEqual(validateAnalysisRunPersistence(repositorySource), []);
});

test("SQL analysis mapping omits nullable observations until provider metadata exists", async () => {
  const rows = JSON.stringify([
    {
      tenant_id: "tenant-1",
      case_id: "case-1",
      analysis_run_id: "analysis-1",
      evidence_id: "evidence-1",
      evidence_version_id: "evidence-version-1",
      model_deployment_id: "deployment-terra",
      model_provider_evidence_id: "provider-evidence-1",
      deployment_residency_evidence_id: "residency-evidence-1",
      prompt_governance_evidence_id: "prompt-evidence-1",
      prompt_template_version: "prompt-v1",
      policy_version: "policy-v1",
      input_manifest_hash: "input-hash-1",
      model_task_class: "GROUNDED_ANALYSIS",
      model_tier: "TERRA",
      model_route_reason: "BASE_ROUTE",
      model_reasoning_effort: "medium",
      model_routing_policy_version: "stratton-model-routing-v1",
      model_name: "gpt-5.6-terra",
      model_version: "2026-07-09",
      model_validation_status: "NOT_RUN",
      model_latency_milliseconds: null,
      model_input_tokens: null,
      model_output_tokens: null,
      model_observed_cost_usd: null,
      status: "QUEUED",
      output_kind: "DRAFT_ONLY",
      unsupported_claims: 0,
      output_reference: null,
      blocked_reason: null,
      output_manifest_hash: null
    }
  ]);
  const executor: SqlExecutor = {
    async queryOne() {
      throw new Error("UNEXPECTED_QUERY_ONE");
    },
    async queryMany() {
      return JSON.parse(rows);
    },
    async execute() {
      throw new Error("UNEXPECTED_EXECUTE");
    },
    async runInTransaction() {
      throw new Error("UNEXPECTED_TRANSACTION");
    },
    async isAvailable() {
      return true;
    },
    async close() {}
  };
  const repository = new SqlWorkloadRepository(executor);

  const record = await repository.getAnalysisRun("tenant-1", "case-1", "analysis-1");

  assert.ok(record);
  assert.equal(record.modelLatencyMilliseconds, undefined);
  assert.equal(record.modelInputTokens, undefined);
  assert.equal(record.modelOutputTokens, undefined);
  assert.equal(record.modelObservedCostUsd, undefined);
  assert.equal(Object.hasOwn(record, "modelLatencyMilliseconds"), false);
  assert.equal(Object.hasOwn(record, "modelInputTokens"), false);
  assert.equal(Object.hasOwn(record, "modelOutputTokens"), false);
  assert.equal(Object.hasOwn(record, "modelObservedCostUsd"), false);
});

test("routing persistence parser rejects cross-wired SQL parameter and row-property mappings", () => {
  const columns = routingColumnMappings.map(([, column]) => column);
  const properties = routingColumnMappings.map(([property]) => property);
  const parameterMappings = routingColumnMappings
    .map(([property, column]) => `${column}: record.${property}`)
    .join(", ");
  const rowMappings = routingColumnMappings
    .map(([property, column]) => `${property}: row.${column}`)
    .join(", ");
  const source = `
class SqlWorkloadRepository {
  public async createAnalysisRun(record: unknown): Promise<void> {
    await this.executor.execute(
      "INSERT INTO dbo.analysis_runs (${columns.join(", ")}) VALUES (${columns.map((column) => `@${column}`).join(", ")})",
      { ${parameterMappings} }
    );
  }
  public async getAnalysisRun(): Promise<unknown> {
    const rows = await this.executor.queryMany(
      "SELECT ${columns.join(", ")} FROM dbo.analysis_runs"
    );
    const row = rows[0];
    return { ${rowMappings} };
  }
}
`;
  assert.deepEqual(validateAnalysisRunPersistence(source), []);

  const crossWiredInsert = source.replace(
    "model_tier: record.modelTier",
    "model_tier: record.modelRouteReason"
  );
  const crossWiredInsertFindings = validateAnalysisRunPersistence(crossWiredInsert);
  assert.equal(
    crossWiredInsertFindings.includes("INSERT model_tier must receive record.modelTier"),
    true
  );

  const crossWiredRead = source.replace(
    "modelRouteReason: row.model_route_reason",
    "modelRouteReason: row.model_tier"
  );
  const crossWiredReadFindings = validateAnalysisRunPersistence(crossWiredRead);
  assert.equal(
    crossWiredReadFindings.includes("SELECT model_route_reason must map to modelRouteReason"),
    true
  );
});

test("routing migration parser ignores SQL decoys and reads every valid ALTER TABLE ADD column", () => {
  const columns = routingColumnMappings.map(([, column]) => column);
  const baseline = "CREATE TABLE dbo.analysis_runs (regional_deployment_evidence_id NVARCHAR(128));";
  const multiColumnMigration = `
    /* ALTER TABLE dbo.analysis_runs ADD model_task_class NVARCHAR(64); */
    SELECT 'ALTER TABLE dbo.analysis_runs ADD model_tier NVARCHAR(16);';
    ALTER TABLE dbo.analysis_runs ADD
      ${columns.map((column, index) => `${column} ${index === columns.length - 1 ? "DECIMAL(18,6)" : "NVARCHAR(128)"}`).join(",\n      ")};
  `;
  const schema = parseSchema(`${baseline}\n${multiColumnMigration}`);
  const analysisRuns = schema.get("analysis_runs");
  assert.ok(analysisRuns);
  for (const column of columns) {
    assert.equal(analysisRuns.has(column), true, column);
  }

  const bracketQuotedMigration = `
    ALTER TABLE dbo.analysis_runs ADD
      ${columns.map((column, index) => `[${column}] ${index === columns.length - 1 ? "DECIMAL(18,6)" : "NVARCHAR(128)"}`).join(",\n      ")};
  `;
  const bracketQuotedSchema = parseSchema(`${baseline}\n${bracketQuotedMigration}`);
  const bracketQuotedRuns = bracketQuotedSchema.get("analysis_runs");
  assert.ok(bracketQuotedRuns);
  for (const column of columns) {
    assert.equal(bracketQuotedRuns.has(column), true, `bracket:${column}`);
  }

  const escapedBracketSchema = parseSchema(`
    ${baseline}
    ALTER TABLE dbo.analysis_runs ADD [routing]]note] NVARCHAR(128);
  `);
  const escapedBracketRuns = escapedBracketSchema.get("analysis_runs");
  assert.ok(escapedBracketRuns);
  assert.equal(
    escapedBracketRuns.has("routing]note"),
    true,
    "escaped bracket identifier"
  );

  const encodingLikeModelTier = "__sql_bracket_identifier_6d6f64656c5f74696572__";
  const collisionMigration = `
    ALTER TABLE dbo.analysis_runs ADD
      ${columns
        .map((column) => `${column === "model_tier" ? encodingLikeModelTier : column} NVARCHAR(128)`)
        .join(",\n      ")};
  `;
  const collisionSchema = parseSchema(`${baseline}\n${collisionMigration}`);
  const collisionRuns = collisionSchema.get("analysis_runs");
  assert.ok(collisionRuns);
  assert.equal(
    collisionRuns.has("model_tier"),
    false,
    "unquoted encoding-like identifier must not become model_tier"
  );

  const dollarCollisionSchema = parseSchema(`
    ${baseline}
    ALTER TABLE dbo.analysis_runs ADD model_tier$collision NVARCHAR(128);
  `);
  const dollarCollisionRuns = dollarCollisionSchema.get("analysis_runs");
  assert.ok(dollarCollisionRuns);
  assert.equal(
    dollarCollisionRuns.has("model_tier"),
    false,
    "unquoted identifier must not prefix-parse before dollar continuation"
  );

  const atVariableTokenSchema = parseSchema(`
    ${baseline}
    ALTER TABLE dbo.analysis_runs ADD @model_tier NVARCHAR(128);
  `);
  const atVariableTokenRuns = atVariableTokenSchema.get("analysis_runs");
  assert.ok(atVariableTokenRuns);
  assert.equal(
    atVariableTokenRuns.has("model_tier"),
    false,
    "@-prefixed SQL variable must not impersonate a column"
  );

  const hashVariableTokenSchema = parseSchema(`
    ${baseline}
    ALTER TABLE dbo.analysis_runs ADD #model_tier NVARCHAR(128);
  `);
  const hashVariableTokenRuns = hashVariableTokenSchema.get("analysis_runs");
  assert.ok(hashVariableTokenRuns);
  assert.equal(
    hashVariableTokenRuns.has("model_tier"),
    false,
    "#-prefixed SQL token must not impersonate a column"
  );

  const trailingBracketTokenSchema = parseSchema(`
    ${baseline}
    ALTER TABLE dbo.analysis_runs ADD [model_tier]$collision NVARCHAR(128);
  `);
  const trailingBracketTokenRuns = trailingBracketTokenSchema.get("analysis_runs");
  assert.ok(trailingBracketTokenRuns);
  assert.equal(
    trailingBracketTokenRuns.has("model_tier"),
    false,
    "bracket identifier must end before its type"
  );

  const decoyOnly = parseSchema(`
    ${baseline}
    -- ALTER TABLE dbo.analysis_runs ADD ${columns.join(" NVARCHAR(64), ")};
    SELECT 'ALTER TABLE dbo.analysis_runs ADD model_tier NVARCHAR(16);';
    SELECT [ALTER TABLE dbo.analysis_runs ADD model_tier NVARCHAR(16)];
    SELECT [ALTER TABLE dbo.analysis_runs ADD model_tier]] NVARCHAR(16)];
  `);
  const decoyRuns = decoyOnly.get("analysis_runs");
  assert.ok(decoyRuns);
  assert.equal(decoyRuns.has("model_tier"), false);

  const missingSecond = parseSchema(`
    ${baseline}
    ALTER TABLE dbo.analysis_runs ADD model_task_class NVARCHAR(64), model_route_reason NVARCHAR(128);
  `);
  const missingSecondRuns = missingSecond.get("analysis_runs");
  assert.ok(missingSecondRuns);
  assert.equal(missingSecondRuns.has("model_tier"), false);

  const wrongLater = parseSchema(`
    ${baseline}
    ALTER TABLE dbo.analysis_runs ADD model_task_class NVARCHAR(64), model_tier NVARCHAR(16),
      model_output_token_count BIGINT;
  `);
  const wrongLaterRuns = wrongLater.get("analysis_runs");
  assert.ok(wrongLaterRuns);
  assert.equal(wrongLaterRuns.has("model_output_tokens"), false);

  const oneColumnStatements = columns
    .map((column) => `ALTER TABLE dbo.analysis_runs ADD [${column}] NVARCHAR(128);`)
    .join("\n");
  const oneColumnSchema = parseSchema(`${baseline}\n${oneColumnStatements}`);
  const oneColumnRuns = oneColumnSchema.get("analysis_runs");
  assert.ok(oneColumnRuns);
  for (const column of columns) {
    assert.equal(oneColumnRuns.has(column), true, `single:${column}`);
  }
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
