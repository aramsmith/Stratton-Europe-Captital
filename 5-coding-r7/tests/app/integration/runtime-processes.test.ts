import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { loadConfig } from "../../../app/src/config.js";

const appRoot = resolve(process.cwd(), "..", "app");
const ts: any = createRequire(resolve(appRoot, "package.json"))("typescript");
const distRoot = resolve(appRoot, "dist");
const scratchRoot = resolve(process.cwd(), "..", "tests", "app", "integration", ".runtime");
const configPath = resolve(appRoot, "src", "config.ts");
const apiMainPath = resolve(appRoot, "src", "api-main.ts");
const workerMainPath = resolve(appRoot, "src", "worker-main.ts");
const workerRuntimePath = resolve(appRoot, "src", "worker-runtime.ts");
const routingDeploymentEnvironmentVariable = "MODEL_ROUTE_DEPLOYMENTS_JSON";
const modelRouteDeploymentsJson = JSON.stringify({
  LUNA: {
    deploymentId: "luna-primary",
    residencyEvidenceId: "luna-residency-evidence",
    modelName: "gpt-5.6-luna",
    modelVersion: "2026-07-09",
    validationStatus: "VALIDATED"
  },
  TERRA: {
    deploymentId: "terra-primary",
    residencyEvidenceId: "terra-residency-evidence",
    modelName: "gpt-5.6-terra",
    modelVersion: "2026-07-09",
    validationStatus: "VALIDATED"
  },
  SOL: {
    deploymentId: "sol-primary",
    residencyEvidenceId: "sol-residency-evidence",
    modelName: "gpt-5.6-sol",
    modelVersion: "2026-07-09",
    validationStatus: "VALIDATED"
  }
});

function parseSource(fileName: string, source: string): any {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function propertyName(source: any, property: any): string | undefined {
  if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
    return undefined;
  }
  return property.name.getText(source).replace(/[\[\]"']/g, "");
}

function objectProperty(
  source: any,
  object: any,
  name: string
): any | undefined {
  return object.properties.find(
    (property: any): property is any =>
      propertyName(source, property) === name
  );
}

function isThisConfigProperty(expression: any, property: string): boolean {
  return (
    ts.isPropertyAccessExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression) &&
    ts.isThis(expression.expression.expression) &&
    expression.expression.name.text === "config" &&
    expression.name.text === property
  );
}

function isLocalConfigProperty(expression: any, property: string): boolean {
  return (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "config" &&
    expression.name.text === property
  );
}

function namedFunction(source: any, name: string): any | undefined {
  return source.statements.find(
    (statement: any): statement is any =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name
  );
}

function classMethod(
  source: any,
  className: string,
  methodName: string
): any | undefined {
  for (const statement of source.statements) {
    if (ts.isClassDeclaration(statement) && statement.name?.text === className) {
      return statement.members.find(
        (member: any): member is any =>
          ts.isMethodDeclaration(member) && member.name.getText(source) === methodName
      );
    }
  }
  return undefined;
}

function namedInterface(source: any, name: string): any | undefined {
  return source.statements.find(
    (statement: any): statement is any =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === name
  );
}

function interfaceProperty(
  source: any,
  declaration: any | undefined,
  name: string
): any | undefined {
  return declaration?.members.find(
    (member: any): member is any =>
      ts.isPropertySignature(member) &&
      member.name?.getText(source).replace(/[\[\]"']/g, "") === name
  );
}

function isReadonly(member: any): boolean {
  return (member.modifiers ?? []).some(
    (modifier: any) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword
  );
}

function hasExactType(source: any, member: any | undefined, type: string): boolean {
  return member?.type?.getText(source).replace(/\s+/g, "") === type;
}

function isNodeWithin(node: any, ancestor: any): boolean {
  return node.pos >= ancestor.pos && node.end <= ancestor.end;
}

function staticBoolean(expression: any): boolean | undefined {
  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  return undefined;
}

function isStaticallyReachable(boundary: any, node: any): boolean {
  let child = node;
  for (let parent = child.parent; parent && parent !== boundary; child = parent, parent = parent.parent) {
    if (ts.isIfStatement(parent)) {
      const condition = staticBoolean(parent.expression);
      if (condition === false && isNodeWithin(node, parent.thenStatement)) {
        return false;
      }
      if (condition === true && parent.elseStatement && isNodeWithin(node, parent.elseStatement)) {
        return false;
      }
    }
    if (ts.isWhileStatement(parent) && staticBoolean(parent.expression) === false) {
      return false;
    }
    if (ts.isBlock(parent)) {
      const statement = parent.statements.find((candidate: any) => isNodeWithin(node, candidate));
      if (statement) {
        const index = parent.statements.indexOf(statement);
        if (
          parent.statements
            .slice(0, index)
            .some((candidate: any) => ts.isReturnStatement(candidate) || ts.isThrowStatement(candidate))
        ) {
          return false;
        }
      }
    }
  }
  return true;
}

function objectCallsInFunction(
  functionNode: any,
  callee: "createApiServer" | "WorkerRuntime"
): readonly any[] {
  const calls: any[] = [];
  const visit = (node: any): void => {
    if (node !== functionNode && ts.isFunctionLike(node)) {
      return;
    }
    const argumentsForTarget =
      callee === "createApiServer" &&
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === callee
        ? node.arguments
        : callee === "WorkerRuntime" &&
            ts.isNewExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === callee
          ? node.arguments
          : undefined;
    const argument = argumentsForTarget?.[0];
    if (argument && ts.isObjectLiteralExpression(argument) && isStaticallyReachable(functionNode, node)) {
      calls.push(argument);
    }
    ts.forEachChild(node, visit);
  };
  visit(functionNode);
  return calls;
}

function hasRequiredConfigCall(node: any, environmentVariable: string): boolean {
  let found = false;
  const visit = (current: any): void => {
    if (found) {
      return;
    }
    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === "required" &&
      ts.isStringLiteral(current.arguments[1]) &&
      current.arguments[1].text === environmentVariable
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function unwrapTransparentExpression(expression: any): any {
  let current = expression;
  while (current) {
    if (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      (typeof ts.isSatisfiesExpression === "function" && ts.isSatisfiesExpression(current)) ||
      (typeof ts.isPartiallyEmittedExpression === "function" && ts.isPartiallyEmittedExpression(current))
    ) {
      current = current.expression;
      continue;
    }
    return current;
  }
  return current;
}

function isAnalysisProviderReceiver(expression: any): boolean {
  const receiver = unwrapTransparentExpression(expression);
  return (
    ts.isPropertyAccessExpression(receiver) &&
    receiver.name.text === "analysisProvider" &&
    (() => {
      const config = unwrapTransparentExpression(receiver.expression);
      return (
        ts.isPropertyAccessExpression(config) &&
        config.name.text === "config" &&
        ts.isThis(config.expression)
      );
    })()
  );
}

function isRunDraftOnlyAnalysisMethodName(expression: any): boolean {
  const methodName = unwrapTransparentExpression(expression);
  return (
    (ts.isStringLiteral(methodName) || ts.isNoSubstitutionTemplateLiteral(methodName)) &&
    methodName.text === "runDraftOnlyAnalysis"
  );
}

function isRunDraftOnlyAnalysisCall(node: any): boolean {
  if (!ts.isCallExpression(node)) {
    return false;
  }
  const callee = unwrapTransparentExpression(node.expression);
  return (
    (ts.isPropertyAccessExpression(callee) && callee.name.text === "runDraftOnlyAnalysis") ||
    (ts.isElementAccessExpression(callee) &&
      Boolean(callee.argumentExpression) &&
      isRunDraftOnlyAnalysisMethodName(callee.argumentExpression))
  );
}

function isDirectAnalysisProviderRunCall(node: any): boolean {
  return (
    isRunDraftOnlyAnalysisCall(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    isAnalysisProviderReceiver(node.expression.expression) &&
    isThisConfigProperty(node.expression.expression, "analysisProvider")
  );
}

function isComputedAnalysisProviderDispatch(node: any): boolean {
  const callee = ts.isCallExpression(node) ? unwrapTransparentExpression(node.expression) : undefined;
  return (
    Boolean(callee) &&
    ts.isElementAccessExpression(callee) &&
    isAnalysisProviderReceiver(callee.expression)
  );
}

function isThisMethodCall(node: any, methodName: string): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isThis(node.expression.expression) &&
    node.expression.name.text === methodName
  );
}

function activeWorkerAnalysisPath(source: any): boolean {
  const handlers = classMethod(source, "WorkerRuntime", "handlers");
  if (!handlers) {
    return false;
  }
  const returns: any[] = [];
  const visitHandlers = (node: any): void => {
    if (node !== handlers && ts.isFunctionLike(node)) {
      return;
    }
    if (ts.isReturnStatement(node) && isStaticallyReachable(handlers, node)) {
      returns.push(node);
    }
    ts.forEachChild(node, visitHandlers);
  };
  ts.forEachChild(handlers, visitHandlers);
  if (
    returns.length !== 1 ||
    !returns[0].expression ||
    !ts.isObjectLiteralExpression(returns[0].expression)
  ) {
    return false;
  }
  const handlerObject = returns[0].expression;
  if (!handlerObject.properties.every((property: any) => ts.isPropertyAssignment(property))) {
    return false;
  }
  const requestHandlers = handlerObject.properties.filter(
    (property: any): boolean =>
      ts.isPropertyAssignment(property) &&
      property.name.getText(source).replace(/[\[\]"']/g, "") === "REQUEST_ANALYSIS"
  );
  if (requestHandlers.length !== 1 || !ts.isFunctionLike(requestHandlers[0].initializer)) {
    return false;
  }
  const requestHandler = requestHandlers[0].initializer;
  const handleAnalysisCalls: any[] = [];
  const visitRequestHandler = (node: any): void => {
    if (node !== requestHandler && ts.isFunctionLike(node)) {
      return;
    }
    if (isThisMethodCall(node, "handleAnalysis") && isStaticallyReachable(requestHandler, node)) {
      handleAnalysisCalls.push(node);
    }
    ts.forEachChild(node, visitRequestHandler);
  };
  visitRequestHandler(requestHandler);
  if (handleAnalysisCalls.length !== 1) {
    return false;
  }

  const worker = source.statements.find(
    (statement: any): boolean => ts.isClassDeclaration(statement) && statement.name?.text === "WorkerRuntime"
  );
  const constructors = worker?.members.filter((member: any): boolean => ts.isConstructorDeclaration(member)) ?? [];
  if (constructors.length !== 1) {
    return false;
  }
  const constructor = constructors[0];
  const consumerAssignments: any[] = [];
  const visitConstructor = (node: any): void => {
    if (node !== constructor && ts.isFunctionLike(node)) {
      return;
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      ts.isThis(node.left.expression) &&
      node.left.name.text === "consumer" &&
      ts.isNewExpression(node.right) &&
      ts.isIdentifier(node.right.expression) &&
      node.right.expression.text === "QueueConsumer" &&
      isStaticallyReachable(constructor, node)
    ) {
      consumerAssignments.push(node);
    }
    ts.forEachChild(node, visitConstructor);
  };
  ts.forEachChild(constructor, visitConstructor);
  return (
    consumerAssignments.length === 1 &&
    isThisMethodCall(consumerAssignments[0].right.arguments?.[2], "handlers")
  );
}

function validateRuntimeRoutingBindings(
  configSource: string,
  apiMainSource: string,
  workerMainSource: string,
  workerRuntimeSource: string
): readonly string[] {
  const findings: string[] = [];
  const config = parseSource("config.ts", configSource);
  const apiMain = parseSource("api-main.ts", apiMainSource);
  const workerMain = parseSource("worker-main.ts", workerMainSource);
  const workerRuntime = parseSource("worker-runtime.ts", workerRuntimeSource);
  const loadConfigFunction = namedFunction(config, "loadConfig");
  const appConfig = namedInterface(config, "AppConfig");

  for (const [property, type] of [
    ["modelRoutingPolicyVersion", '"stratton-model-routing-v1"'],
    ["modelRouteDeployments", "ModelRouteDeployments"]
  ] as const) {
    const member = interfaceProperty(config, appConfig, property);
    if (!member || !isReadonly(member) || !hasExactType(config, member, type)) {
      findings.push(`AppConfig must expose readonly ${property}: ${type}`);
    }
  }
  const apiRuntimeConfig = namedInterface(apiMain, "ApiRuntimeConfig");
  const apiPolicyVersion = interfaceProperty(apiMain, apiRuntimeConfig, "modelRoutingPolicyVersion");
  if (
    !apiPolicyVersion ||
    !isReadonly(apiPolicyVersion) ||
    !hasExactType(apiMain, apiPolicyVersion, '"stratton-model-routing-v1"')
  ) {
    findings.push(
      'ApiRuntimeConfig must expose readonly modelRoutingPolicyVersion: "stratton-model-routing-v1"'
    );
  }
  if (
    interfaceProperty(config, appConfig, "regionalDeploymentEvidenceId") ||
    (loadConfigFunction && hasRequiredConfigCall(loadConfigFunction, "REGIONAL_DEPLOYMENT_EVIDENCE_ID"))
  ) {
    findings.push("AppConfig must not use active legacy regional routing configuration");
  }

  if (!loadConfigFunction) {
    findings.push("config.ts must define loadConfig");
  } else {
    const returns: any[] = [];
    const visit = (node: any): void => {
      if (ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(node.expression)) {
        returns.push(node.expression);
      }
      ts.forEachChild(node, visit);
    };
    visit(loadConfigFunction);
    const returned = returns[0];
    for (const [property, environmentVariable] of [
      ["modelRoutingPolicyVersion", "MODEL_ROUTING_POLICY_VERSION"],
      ["modelRouteDeployments", routingDeploymentEnvironmentVariable]
    ] as const) {
      const assignment = returned && objectProperty(config, returned, property);
      if (
        !assignment ||
        !ts.isPropertyAssignment(assignment) ||
        !ts.isCallExpression(assignment.initializer) ||
        !hasRequiredConfigCall(assignment, environmentVariable)
      ) {
        findings.push(`loadConfig must parse ${environmentVariable} into ${property}`);
      }
    }
  }

  const requireRuntimeConfig = (
    source: any,
    functionNode: any | undefined,
    callee: "createApiServer" | "WorkerRuntime",
    expectedCalls: number,
    label: string
  ): void => {
    const calls = functionNode ? objectCallsInFunction(functionNode, callee) : [];
    if (calls.length < expectedCalls) {
      findings.push(`${label} must construct ${expectedCalls} ${callee} runtime(s) in run`);
      return;
    }
    for (const call of calls) {
      for (const property of [
        "modelRoutingPolicyVersion",
        "modelRouteDeployments"
      ] as const) {
        const assignment = objectProperty(source, call, property);
        if (
          !assignment ||
          !ts.isPropertyAssignment(assignment) ||
          !isLocalConfigProperty(assignment.initializer, property)
        ) {
          findings.push(`${label} must pass config.${property} to ${callee}`);
        }
      }
      if (objectProperty(source, call, "regionalDeploymentEvidenceId")) {
        findings.push(`${label} must not use active legacy regional routing configuration`);
      }
    }
  };

  requireRuntimeConfig(apiMain, namedFunction(apiMain, "run"), "createApiServer", 2, "api-main.ts");
  requireRuntimeConfig(workerMain, namedFunction(workerMain, "run"), "WorkerRuntime", 2, "worker-main.ts");

  const handleAnalysis = classMethod(workerRuntime, "WorkerRuntime", "handleAnalysis");
  const workerConfig = namedInterface(workerRuntime, "WorkerRuntimeConfig");
  for (const [property, type] of [
    ["modelRoutingPolicyVersion", '"stratton-model-routing-v1"'],
    ["modelRouteDeployments", "ModelRouteDeployments"]
  ] as const) {
    const member = interfaceProperty(workerRuntime, workerConfig, property);
    if (!member || !isReadonly(member) || !hasExactType(workerRuntime, member, type)) {
      findings.push(`WorkerRuntimeConfig must expose readonly ${property}: ${type}`);
    }
  }
  if (interfaceProperty(workerRuntime, workerConfig, "regionalDeploymentEvidenceId")) {
    findings.push("WorkerRuntimeConfig must not use active legacy regional routing configuration");
  }
  const providerCalls: any[] = [];
  const computedProviderDispatches: any[] = [];
  if (handleAnalysis) {
    const visit = (node: any): void => {
      if (node !== handleAnalysis && ts.isFunctionLike(node)) {
        return;
      }
      if (isStaticallyReachable(handleAnalysis, node)) {
        if (isRunDraftOnlyAnalysisCall(node)) {
          providerCalls.push(node);
        }
        if (isComputedAnalysisProviderDispatch(node)) {
          computedProviderDispatches.push(node);
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(handleAnalysis, visit);
  }
  if (!activeWorkerAnalysisPath(workerRuntime)) {
    findings.push("WorkerRuntime.handleAnalysis must be reachable from the active REQUEST_ANALYSIS worker path");
  }
  if (providerCalls.length !== 1) {
    findings.push(
      "WorkerRuntime.handleAnalysis must make exactly one reachable runDraftOnlyAnalysis call"
    );
  }
  if (computedProviderDispatches.length > 0) {
    findings.push(
      "WorkerRuntime.handleAnalysis must not use computed provider dispatch on this.config.analysisProvider"
    );
  }
  const providerCall = providerCalls.length === 1 ? providerCalls[0] : undefined;
  if (!providerCall || !isDirectAnalysisProviderRunCall(providerCall)) {
    findings.push(
      "WorkerRuntime.handleAnalysis must make its reachable runDraftOnlyAnalysis call via direct dot syntax on this.config.analysisProvider"
    );
  }
  if (
    !providerCall ||
    providerCall.arguments.length !== 1 ||
    !ts.isObjectLiteralExpression(providerCall.arguments[0])
  ) {
    findings.push(
      "WorkerRuntime.handleAnalysis must make its reachable runDraftOnlyAnalysis call with exactly one object-literal argument"
    );
  }
  const providerInput =
    providerCall &&
    isDirectAnalysisProviderRunCall(providerCall) &&
    providerCall.arguments.length === 1 &&
    ts.isObjectLiteralExpression(providerCall.arguments[0])
      ? providerCall.arguments[0]
      : undefined;
  if (providerInput) {
    const deployment = objectProperty(workerRuntime, providerInput, "modelDeploymentId");
    const residency = objectProperty(workerRuntime, providerInput, "deploymentResidencyEvidenceId");
    const policy = objectProperty(workerRuntime, providerInput, "modelRoutingPolicyVersion");
    const isRunTier = (expression: any): boolean =>
      ts.isPropertyAccessExpression(expression) &&
      expression.name.text === "modelTier" &&
      ts.isPropertyAccessExpression(expression.expression) &&
      expression.expression.name.text === "run" &&
      ts.isIdentifier(expression.expression.expression) &&
      expression.expression.expression.text === "state";
    const isDeploymentLeaf = (expression: any, leaf: string): boolean =>
      ts.isPropertyAccessExpression(expression) &&
      expression.name.text === leaf &&
      ts.isElementAccessExpression(expression.expression) &&
      isThisConfigProperty(expression.expression.expression, "modelRouteDeployments") &&
      isRunTier(expression.expression.argumentExpression);
    if (
      !deployment ||
      !ts.isPropertyAssignment(deployment) ||
      !isDeploymentLeaf(deployment.initializer, "deploymentId")
    ) {
      findings.push(
        "WorkerRuntime must pass config.modelRouteDeployments[state.run.modelTier].deploymentId as modelDeploymentId to the analysis provider"
      );
    }
    if (
      !residency ||
      !ts.isPropertyAssignment(residency) ||
      !isDeploymentLeaf(residency.initializer, "residencyEvidenceId")
    ) {
      findings.push(
        "WorkerRuntime must pass config.modelRouteDeployments[state.run.modelTier].residencyEvidenceId as deploymentResidencyEvidenceId to the analysis provider"
      );
    }
    if (
      !policy ||
      !ts.isPropertyAssignment(policy) ||
      !isThisConfigProperty(policy.initializer, "modelRoutingPolicyVersion")
    ) {
      findings.push("WorkerRuntime must pass config.modelRoutingPolicyVersion to the analysis provider");
    }
  }
  return findings;
}

test("runtime routing contract rejects active legacy global residency setting", () => {
  const legacyConfigSource = `
export interface AppConfig {
  readonly modelRoutingPolicyVersion: string;
  readonly modelRouteDeployments: ModelRouteDeployments;
  readonly regionalDeploymentEvidenceId: string;
}
function required(env: unknown, name: string): string { return name; }
function loadConfig(env: unknown): AppConfig {
  return {
    modelRoutingPolicyVersion: required(env, "MODEL_ROUTING_POLICY_VERSION"),
    modelRouteDeployments: parseDeployments(required(env, "MODEL_ROUTE_DEPLOYMENTS_JSON")),
    regionalDeploymentEvidenceId: required(env, "REGIONAL_DEPLOYMENT_EVIDENCE_ID")
  };
}
`;
  const legacyApiMainSource = `
async function run() {
  createApiServer({ modelRoutingPolicyVersion: config.modelRoutingPolicyVersion, modelRouteDeployments: config.modelRouteDeployments, regionalDeploymentEvidenceId: config.regionalDeploymentEvidenceId });
  createApiServer({ modelRoutingPolicyVersion: config.modelRoutingPolicyVersion, modelRouteDeployments: config.modelRouteDeployments, regionalDeploymentEvidenceId: config.regionalDeploymentEvidenceId });
}
`;
  const legacyWorkerMainSource = `
async function run() {
  new WorkerRuntime({ modelRoutingPolicyVersion: config.modelRoutingPolicyVersion, modelRouteDeployments: config.modelRouteDeployments, regionalDeploymentEvidenceId: config.regionalDeploymentEvidenceId });
  new WorkerRuntime({ modelRoutingPolicyVersion: config.modelRoutingPolicyVersion, modelRouteDeployments: config.modelRouteDeployments, regionalDeploymentEvidenceId: config.regionalDeploymentEvidenceId });
}
`;
  const legacyWorkerRuntimeSource = `
export interface WorkerRuntimeConfig {
  readonly modelRoutingPolicyVersion: string;
  readonly modelRouteDeployments: ModelRouteDeployments;
  readonly regionalDeploymentEvidenceId: string;
}
class WorkerRuntime {
  constructor() {
    this.consumer = new QueueConsumer(
      this.config.repository,
      this.config.idempotencyStore,
      this.handlers(),
      {}
    );
  }
  private handlers() {
    return { REQUEST_ANALYSIS: async () => this.handleAnalysis() };
  }
  async handleAnalysis() {
    this.config.analysisProvider.runDraftOnlyAnalysis({
      modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTier].deploymentId,
      deploymentResidencyEvidenceId: this.config.modelRouteDeployments[state.run.modelTier].residencyEvidenceId,
      modelRoutingPolicyVersion: this.config.modelRoutingPolicyVersion
    });
  }
}
`;
  const findings = validateRuntimeRoutingBindings(
    legacyConfigSource,
    legacyApiMainSource,
    legacyWorkerMainSource,
    legacyWorkerRuntimeSource
  );
  assert.equal(
    findings.some((finding) => finding.includes("must not use active legacy regional routing configuration")),
    true
  );
});

test("routing configuration parses all approved deployments and policy residency evidence", () => {
  const config = loadConfig({
    APP_ENV: "tst",
    ROLLOUT_ADMISSION_MAX: "20",
    LOG_LEVEL: "INFO",
    MODEL_PROVIDER_EVIDENCE_ID: "model-provider-evidence",
    PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt-governance-evidence",
    MODEL_ROUTING_POLICY_VERSION: "stratton-model-routing-v1",
    [routingDeploymentEnvironmentVariable]: modelRouteDeploymentsJson
  });
  assert.equal(config.modelRoutingPolicyVersion, "stratton-model-routing-v1");
  for (const [tier, deploymentId, residencyEvidenceId] of [
    ["LUNA", "luna-primary", "luna-residency-evidence"],
    ["TERRA", "terra-primary", "terra-residency-evidence"],
    ["SOL", "sol-primary", "sol-residency-evidence"]
  ] as const) {
    assert.equal(config.modelRouteDeployments[tier].deploymentId, deploymentId, tier);
    assert.equal(config.modelRouteDeployments[tier].residencyEvidenceId, residencyEvidenceId, tier);
  }
});

test("routing configuration rejects unsupported routing policy versions", () => {
  assert.throws(
    () =>
      loadConfig({
        APP_ENV: "tst",
        ROLLOUT_ADMISSION_MAX: "20",
        LOG_LEVEL: "INFO",
        MODEL_PROVIDER_EVIDENCE_ID: "model-provider-evidence",
        PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt-governance-evidence",
        MODEL_ROUTING_POLICY_VERSION: "stratton-model-routing-v2",
        [routingDeploymentEnvironmentVariable]: modelRouteDeploymentsJson
      }),
    /INVALID_MODEL_ROUTING_POLICY_VERSION/
  );
});

test("runtime wiring rejects dead-code and decoy routing configuration", () => {
  const configSource = `
export interface AppConfig {
  readonly modelRoutingPolicyVersion: "stratton-model-routing-v1";
  readonly modelRouteDeployments: ModelRouteDeployments;
}
function required(env: unknown, name: string): string { return name; }
function loadConfig(env: unknown): AppConfig {
  return {
    modelRoutingPolicyVersion: required(env, "MODEL_ROUTING_POLICY_VERSION"),
    modelRouteDeployments: parseDeployments(required(env, "MODEL_ROUTE_DEPLOYMENTS_JSON"))
  };
}
`;
  const apiMainSource = `
export interface ApiRuntimeConfig {
  readonly modelRoutingPolicyVersion: "stratton-model-routing-v1";
}
async function run() {
  createApiServer({ modelRoutingPolicyVersion: config.modelRoutingPolicyVersion, modelRouteDeployments: config.modelRouteDeployments });
  createApiServer({ modelRoutingPolicyVersion: config.modelRoutingPolicyVersion, modelRouteDeployments: config.modelRouteDeployments });
}
`;
  const workerMainSource = `
async function run() {
  new WorkerRuntime({ modelRoutingPolicyVersion: config.modelRoutingPolicyVersion, modelRouteDeployments: config.modelRouteDeployments });
  new WorkerRuntime({ modelRoutingPolicyVersion: config.modelRoutingPolicyVersion, modelRouteDeployments: config.modelRouteDeployments });
}
`;
  const workerRuntimeSource = `
export interface WorkerRuntimeConfig {
  readonly modelRoutingPolicyVersion: "stratton-model-routing-v1";
  readonly modelRouteDeployments: ModelRouteDeployments;
}
class WorkerRuntime {
  constructor() {
    this.consumer = new QueueConsumer(
      this.config.repository,
      this.config.idempotencyStore,
      this.handlers(),
      {}
    );
  }
  private handlers() {
    return { REQUEST_ANALYSIS: async () => this.handleAnalysis() };
  }
  async handleAnalysis() {
    this.config.analysisProvider.runDraftOnlyAnalysis({
      modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTier].deploymentId,
      deploymentResidencyEvidenceId: this.config.modelRouteDeployments[state.run.modelTier].residencyEvidenceId,
      modelRoutingPolicyVersion: this.config.modelRoutingPolicyVersion
    });
  }
}
`;
  assert.deepEqual(
    validateRuntimeRoutingBindings(configSource, apiMainSource, workerMainSource, workerRuntimeSource),
    []
  );

  const widenedConfigType = configSource.replace(
    'readonly modelRoutingPolicyVersion: "stratton-model-routing-v1";',
    "readonly modelRoutingPolicyVersion: string;"
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      widenedConfigType,
      apiMainSource,
      workerMainSource,
      workerRuntimeSource
    ).some((finding) => finding.includes('AppConfig must expose readonly modelRoutingPolicyVersion: "stratton-model-routing-v1"')),
    true
  );

  const widenedApiRuntimeConfigType = apiMainSource.replace(
    'readonly modelRoutingPolicyVersion: "stratton-model-routing-v1";',
    "readonly modelRoutingPolicyVersion: string;"
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      widenedApiRuntimeConfigType,
      workerMainSource,
      workerRuntimeSource
    ).some((finding) => finding.includes('ApiRuntimeConfig must expose readonly modelRoutingPolicyVersion: "stratton-model-routing-v1"')),
    true
  );

  const widenedWorkerRuntimeConfigType = workerRuntimeSource.replace(
    'readonly modelRoutingPolicyVersion: "stratton-model-routing-v1";',
    "readonly modelRoutingPolicyVersion: string;"
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      widenedWorkerRuntimeConfigType
    ).some((finding) => finding.includes('WorkerRuntimeConfig must expose readonly modelRoutingPolicyVersion: "stratton-model-routing-v1"')),
    true
  );

  const decoyApiMain = `
function unused() {
  createApiServer({ modelRoutingPolicyVersion: config.modelRoutingPolicyVersion, modelRouteDeployments: config.modelRouteDeployments });
  createApiServer({ modelRoutingPolicyVersion: config.modelRoutingPolicyVersion, modelRouteDeployments: config.modelRouteDeployments });
}
async function run() {
  createApiServer({ modelRoutingPolicyVersion: config.modelRoutingPolicyVersion });
  createApiServer({ modelRoutingPolicyVersion: config.modelRoutingPolicyVersion });
}
`;
  assert.equal(
    validateRuntimeRoutingBindings(configSource, decoyApiMain, workerMainSource, workerRuntimeSource).some(
      (finding) => finding.includes("api-main.ts must pass config.modelRouteDeployments")
    ),
    true
  );

  const wrongWorkerCallSite = workerMainSource.replace(
    "modelRouteDeployments: config.modelRouteDeployments",
    "modelRouteDeployments: config.modelRouteDeployments.LUNA"
  );
  assert.equal(
    validateRuntimeRoutingBindings(configSource, apiMainSource, wrongWorkerCallSite, workerRuntimeSource).some(
      (finding) => finding.includes("worker-main.ts must pass config.modelRouteDeployments")
    ),
    true
  );

  const swappedProviderLeaves = workerRuntimeSource.replace(
    "modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTier].deploymentId",
    "modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTier].residencyEvidenceId"
  );
  const swappedProviderLeafFindings = validateRuntimeRoutingBindings(
    configSource,
    apiMainSource,
    workerMainSource,
    swappedProviderLeaves
  );
  assert.equal(
    swappedProviderLeafFindings.includes(
      "WorkerRuntime must pass config.modelRouteDeployments[state.run.modelTier].deploymentId as modelDeploymentId to the analysis provider"
    ),
    true
  );

  const swappedResidencyLeaf = workerRuntimeSource.replace(
    "deploymentResidencyEvidenceId: this.config.modelRouteDeployments[state.run.modelTier].residencyEvidenceId",
    "deploymentResidencyEvidenceId: this.config.modelRouteDeployments[state.run.modelTier].deploymentId"
  );
  const swappedResidencyLeafFindings = validateRuntimeRoutingBindings(
    configSource,
    apiMainSource,
    workerMainSource,
    swappedResidencyLeaf
  );
  assert.equal(
    swappedResidencyLeafFindings.includes(
      "WorkerRuntime must pass config.modelRouteDeployments[state.run.modelTier].residencyEvidenceId as deploymentResidencyEvidenceId to the analysis provider"
    ),
    true
  );

  const wrongProviderMapKey = workerRuntimeSource.replace(
    "modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTier].deploymentId",
    "modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTaskClass].deploymentId"
  );
  assert.equal(
    validateRuntimeRoutingBindings(configSource, apiMainSource, workerMainSource, wrongProviderMapKey).some(
      (finding) => finding.includes("modelDeploymentId to the analysis provider")
    ),
    true
  );

  const unrelatedProviderReceiver = workerRuntimeSource.replace(
    "this.config.analysisProvider.runDraftOnlyAnalysis",
    "this.unrelatedProvider.runDraftOnlyAnalysis"
  );
  assert.equal(
    validateRuntimeRoutingBindings(configSource, apiMainSource, workerMainSource, unrelatedProviderReceiver).some(
      (finding) => finding.includes("this.config.analysisProvider")
    ),
    true
  );

  const secondVariableArgumentProviderCall = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    const alternateProviderInput = {};
    this.config.analysisProvider.runDraftOnlyAnalysis(alternateProviderInput);
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      secondVariableArgumentProviderCall
    ).some((finding) => finding.includes("exactly one reachable runDraftOnlyAnalysis")),
    true
  );

  const secondNoArgumentProviderCall = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    this.config.analysisProvider.runDraftOnlyAnalysis();
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      secondNoArgumentProviderCall
    ).some((finding) => finding.includes("exactly one reachable runDraftOnlyAnalysis")),
    true
  );

  const secondComputedLiteralProviderCall = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    const alternateInput = {};
    this.config.analysisProvider["runDraftOnlyAnalysis"](alternateInput);
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      secondComputedLiteralProviderCall
    ).some((finding) => finding.includes("exactly one reachable runDraftOnlyAnalysis")),
    true
  );

  const secondUnrelatedComputedLiteralProviderCall = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    this.unrelatedProvider["runDraftOnlyAnalysis"]();
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      secondUnrelatedComputedLiteralProviderCall
    ).some((finding) => finding.includes("exactly one reachable runDraftOnlyAnalysis")),
    true
  );

  const secondTemplateComputedProviderCall = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    this.config.analysisProvider[\`runDraftOnlyAnalysis\`]({});
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      secondTemplateComputedProviderCall
    ).some((finding) => finding.includes("exactly one reachable runDraftOnlyAnalysis")),
    true
  );

  const dynamicProviderDispatch = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    const method = "runDraftOnlyAnalysis";
    this.config.analysisProvider[method]({});
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      dynamicProviderDispatch
    ).some((finding) => finding.includes("must not use computed provider dispatch")),
    true
  );

  const soleComputedProviderCall = workerRuntimeSource.replace(
    "this.config.analysisProvider.runDraftOnlyAnalysis",
    'this.config.analysisProvider["runDraftOnlyAnalysis"]'
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      soleComputedProviderCall
    ).some((finding) => finding.includes("direct dot syntax on this.config.analysisProvider")),
    true
  );

  const parenthesizedOwnedComputedProviderCall = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    const alternateInput = {};
    (this.config.analysisProvider["runDraftOnlyAnalysis"])(alternateInput);
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      parenthesizedOwnedComputedProviderCall
    ).some((finding) => finding.includes("exactly one reachable runDraftOnlyAnalysis")),
    true
  );

  const parenthesizedDynamicProviderDispatch = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    const method = "runDraftOnlyAnalysis";
    (this.config.analysisProvider[method])(alternateInput);
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      parenthesizedDynamicProviderDispatch
    ).some((finding) => finding.includes("must not use computed provider dispatch")),
    true
  );

  const parenthesizedUnrelatedComputedProviderCall = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    (this.unrelatedProvider["runDraftOnlyAnalysis"])();
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      parenthesizedUnrelatedComputedProviderCall
    ).some((finding) => finding.includes("exactly one reachable runDraftOnlyAnalysis")),
    true
  );

  const parenthesizedComputedMethodNameProviderCall = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    const alternateInput = {};
    this.config.analysisProvider[("runDraftOnlyAnalysis")](alternateInput);
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      parenthesizedComputedMethodNameProviderCall
    ).some((finding) => finding.includes("exactly one reachable runDraftOnlyAnalysis")),
    true
  );

  const parenthesizedComputedMethodNameUnrelatedProviderCall = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    this.unrelatedProvider[("runDraftOnlyAnalysis")]();
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      parenthesizedComputedMethodNameUnrelatedProviderCall
    ).some((finding) => finding.includes("exactly one reachable runDraftOnlyAnalysis")),
    true
  );

  const assertedComputedMethodNameProviderCall = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    this.config.analysisProvider[("runDraftOnlyAnalysis" as const)](alternateInput);
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      assertedComputedMethodNameProviderCall
    ).some((finding) => finding.includes("exactly one reachable runDraftOnlyAnalysis")),
    true
  );

  const parenthesizedTemplateMethodNameProviderCall = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    this.config.analysisProvider[(\`runDraftOnlyAnalysis\`)](alternateInput);
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      parenthesizedTemplateMethodNameProviderCall
    ).some((finding) => finding.includes("exactly one reachable runDraftOnlyAnalysis")),
    true
  );

  const parenthesizedDirectProviderCall = workerRuntimeSource.replace(
    "this.config.analysisProvider.runDraftOnlyAnalysis",
    "(this.config.analysisProvider.runDraftOnlyAnalysis)"
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      parenthesizedDirectProviderCall
    ).some((finding) => finding.includes("direct dot syntax on this.config.analysisProvider")),
    true
  );

  const assertedOwnedComputedProviderCall = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    ((this.config.analysisProvider as any)["runDraftOnlyAnalysis"])(alternateInput);
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      assertedOwnedComputedProviderCall
    ).some((finding) => finding.includes("exactly one reachable runDraftOnlyAnalysis")),
    true
  );

  const nonNullOwnedComputedProviderCall = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    ((this.config.analysisProvider!)["runDraftOnlyAnalysis"])(alternateInput);
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      nonNullOwnedComputedProviderCall
    ).some((finding) => finding.includes("exactly one reachable runDraftOnlyAnalysis")),
    true
  );

  const satisfiesOwnedComputedProviderCall = workerRuntimeSource.replace(
    "    });\n  }\n}",
    `    });
    ((this.config.analysisProvider satisfies any)["runDraftOnlyAnalysis"])(alternateInput);
  }
}`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      satisfiesOwnedComputedProviderCall
    ).some((finding) => finding.includes("exactly one reachable runDraftOnlyAnalysis")),
    true
  );

  const nonNullDirectProviderCall = workerRuntimeSource.replace(
    "this.config.analysisProvider.runDraftOnlyAnalysis",
    "this.config.analysisProvider!.runDraftOnlyAnalysis"
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      nonNullDirectProviderCall
    ).some((finding) => finding.includes("direct dot syntax on this.config.analysisProvider")),
    true
  );

  const wrongShapedSoleProviderCall = workerRuntimeSource.replace(
    `this.config.analysisProvider.runDraftOnlyAnalysis({
      modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTier].deploymentId,
      deploymentResidencyEvidenceId: this.config.modelRouteDeployments[state.run.modelTier].residencyEvidenceId,
      modelRoutingPolicyVersion: this.config.modelRoutingPolicyVersion
    });`,
    `const providerInput = {};
    this.config.analysisProvider.runDraftOnlyAnalysis(providerInput);`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      wrongShapedSoleProviderCall
    ).some((finding) => finding.includes("exactly one object-literal argument")),
    true
  );

  const deadProviderDecoy = workerRuntimeSource
    .replace(
      "modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTier].deploymentId",
      "modelDeploymentId: this.config.modelRouteDeployments"
    )
    .replace(
      "async handleAnalysis() {",
      `async handleAnalysis() {
    const decoy = () => this.config.analysisProvider.runDraftOnlyAnalysis({
      modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTier].deploymentId,
      deploymentResidencyEvidenceId: this.config.modelRouteDeployments[state.run.modelTier].residencyEvidenceId,
      modelRoutingPolicyVersion: this.config.modelRoutingPolicyVersion
    });`
    );
  assert.equal(
    validateRuntimeRoutingBindings(configSource, apiMainSource, workerMainSource, deadProviderDecoy).some(
      (finding) => finding.includes("modelDeploymentId to the analysis provider")
    ),
    true
  );

  const unreachableProviderBranch = workerRuntimeSource
    .replace(
      "modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTier].deploymentId",
      "modelDeploymentId: this.config.modelRouteDeployments"
    )
    .replace(
      "async handleAnalysis() {",
      `async handleAnalysis() {
    if (false) {
      this.config.analysisProvider.runDraftOnlyAnalysis({
        modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTier].deploymentId,
        deploymentResidencyEvidenceId: this.config.modelRouteDeployments[state.run.modelTier].residencyEvidenceId,
        modelRoutingPolicyVersion: this.config.modelRoutingPolicyVersion
      });
    }`
    );
  assert.equal(
    validateRuntimeRoutingBindings(configSource, apiMainSource, workerMainSource, unreachableProviderBranch).some(
      (finding) => finding.includes("modelDeploymentId to the analysis provider")
    ),
    true
  );

  const uninvokedAnalysisHandler = workerRuntimeSource.replace(
    "return { REQUEST_ANALYSIS: async () => this.handleAnalysis() };",
    "return { REQUEST_ANALYSIS: async () => undefined };"
  );
  assert.equal(
    validateRuntimeRoutingBindings(configSource, apiMainSource, workerMainSource, uninvokedAnalysisHandler).some(
      (finding) => finding.includes("active REQUEST_ANALYSIS worker path")
    ),
    true
  );

  const crossWiredProvider = workerRuntimeSource.replace(
    "modelRoutingPolicyVersion: this.config.modelRoutingPolicyVersion",
    "modelRoutingPolicyVersion: state.run.modelRoutingPolicyVersion"
  );
  const crossWiredProviderFindings = validateRuntimeRoutingBindings(
    configSource,
    apiMainSource,
    workerMainSource,
    crossWiredProvider
  );
  assert.equal(
    crossWiredProviderFindings.includes(
      "WorkerRuntime must pass config.modelRoutingPolicyVersion to the analysis provider"
    ),
    true
  );

  const bareLocalConfigProvider = workerRuntimeSource.replace(
    "this.config.analysisProvider.runDraftOnlyAnalysis",
    "config.analysisProvider.runDraftOnlyAnalysis"
  );
  assert.equal(
    validateRuntimeRoutingBindings(configSource, apiMainSource, workerMainSource, bareLocalConfigProvider).some(
      (finding) => finding.includes("this.config.analysisProvider")
    ),
    true
  );

  const otherHandlerRegistrationWithDecoy = workerRuntimeSource.replace(
    "this.handlers(),",
    "this.otherHandlers(),"
  ).replace(
    "this.consumer = new QueueConsumer(",
    `this.handlers();
    this.consumer = new QueueConsumer(`
  );
  assert.equal(
    validateRuntimeRoutingBindings(
      configSource,
      apiMainSource,
      workerMainSource,
      otherHandlerRegistrationWithDecoy
    ).some((finding) => finding.includes("active REQUEST_ANALYSIS worker path")),
    true
  );

  const localHandlerDecoy = workerRuntimeSource.replace(
    "return { REQUEST_ANALYSIS: async () => this.handleAnalysis() };",
    `const localDecoy = { REQUEST_ANALYSIS: async () => this.handleAnalysis() };
    return { REQUEST_INGESTION: async () => undefined };`
  );
  assert.equal(
    validateRuntimeRoutingBindings(configSource, apiMainSource, workerMainSource, localHandlerDecoy).some(
      (finding) => finding.includes("active REQUEST_ANALYSIS worker path")
    ),
    true
  );

  const spreadHandlerAlias = workerRuntimeSource.replace(
    "return { REQUEST_ANALYSIS: async () => this.handleAnalysis() };",
    `const handlers = { REQUEST_ANALYSIS: async () => this.handleAnalysis() };
    return { ...handlers };`
  );
  assert.equal(
    validateRuntimeRoutingBindings(configSource, apiMainSource, workerMainSource, spreadHandlerAlias).some(
      (finding) => finding.includes("active REQUEST_ANALYSIS worker path")
    ),
    true
  );

  const duplicateHandler = workerRuntimeSource.replace(
    "return { REQUEST_ANALYSIS: async () => this.handleAnalysis() };",
    `return {
      REQUEST_ANALYSIS: async () => this.handleAnalysis(),
      REQUEST_ANALYSIS: async () => this.handleAnalysis()
    };`
  );
  assert.equal(
    validateRuntimeRoutingBindings(configSource, apiMainSource, workerMainSource, duplicateHandler).some(
      (finding) => finding.includes("active REQUEST_ANALYSIS worker path")
    ),
    true
  );

  const postReturnProviderCall = workerRuntimeSource
    .replace(
      "modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTier].deploymentId",
      "modelDeploymentId: this.config.modelRouteDeployments"
    )
    .replace(
      "async handleAnalysis() {",
      `async handleAnalysis() {
    return;
    this.config.analysisProvider.runDraftOnlyAnalysis({
      modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTier].deploymentId,
      deploymentResidencyEvidenceId: this.config.modelRouteDeployments[state.run.modelTier].residencyEvidenceId,
      modelRoutingPolicyVersion: this.config.modelRoutingPolicyVersion
    });`
    );
  assert.equal(
    validateRuntimeRoutingBindings(configSource, apiMainSource, workerMainSource, postReturnProviderCall).some(
      (finding) => finding.includes("this.config.analysisProvider")
    ),
    true
  );

  const uninvokedProviderCall = workerRuntimeSource
    .replace(
      "modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTier].deploymentId",
      "modelDeploymentId: this.config.modelRouteDeployments"
    )
    .replace(
      "async handleAnalysis() {",
      `async handleAnalysis() {
    const providerDecoy = () => this.config.analysisProvider.runDraftOnlyAnalysis({
      modelDeploymentId: this.config.modelRouteDeployments[state.run.modelTier].deploymentId,
      deploymentResidencyEvidenceId: this.config.modelRouteDeployments[state.run.modelTier].residencyEvidenceId,
      modelRoutingPolicyVersion: this.config.modelRoutingPolicyVersion
    });`
    );
  assert.equal(
    validateRuntimeRoutingBindings(configSource, apiMainSource, workerMainSource, uninvokedProviderCall).some(
      (finding) => finding.includes("modelDeploymentId to the analysis provider")
    ),
    true
  );

  const elementAccessTier = workerRuntimeSource.replace(
    "state.run.modelTier",
    'state.run["modelTier"]'
  );
  assert.equal(
    validateRuntimeRoutingBindings(configSource, apiMainSource, workerMainSource, elementAccessTier).some(
      (finding) => finding.includes("modelDeploymentId to the analysis provider")
    ),
    true
  );
});

function launch(script: string, env: NodeJS.ProcessEnv) {
  return spawn(process.execPath, [script], {
    cwd: appRoot,
    env: { ...process.env, ...env },
    stdio: "pipe"
  });
}

async function waitForExit(child: ReturnType<typeof spawn>) {
  let stderr = "";
  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
  }
  const code = await new Promise<number | null>((resolveCode) => {
    child.on("exit", (value) => resolveCode(value));
  });
  return { code, stderr };
}

async function waitForExitOrTimeout(child: ReturnType<typeof spawn>, timeoutMs: number) {
  let stderr = "";
  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
  }
  const exited = new Promise<number | null>((resolveCode) => {
    child.on("exit", (value) => resolveCode(value));
  });
  let timeout: NodeJS.Timeout | undefined;
  const timedOut = await Promise.race([
    exited.then((code) => ({ timedOut: false, code })),
    new Promise<{ timedOut: true; code: undefined }>((resolveTimeout) => {
      timeout = setTimeout(() => resolveTimeout({ timedOut: true, code: undefined }), timeoutMs);
    })
  ]);
  if (timeout) {
    clearTimeout(timeout);
  }
  if (timedOut.timedOut) {
    child.kill("SIGTERM");
    await exited;
  }
  return { ...timedOut, stderr };
}

test("api test mode requires application-owned routing deployment configuration", async () => {
  const child = launch(resolve(distRoot, "api-main.js"), {
    APP_ENV: "tst",
    ROLLOUT_ADMISSION_MAX: "20",
    LOG_LEVEL: "INFO",
    MODEL_PROVIDER_EVIDENCE_ID: "model",
    PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt",
    MODEL_ROUTING_POLICY_VERSION: "stratton-model-routing-v1",
    API_PORT: "40100",
    API_RUNTIME_MODE: "test",
    ALLOW_TEST_ADAPTERS: "true"
  });
  const result = await waitForExitOrTimeout(child, 1_000);
  assert.equal(result.timedOut, false);
  assert.notEqual(result.code, 0);
  assert.equal(
    result.stderr.includes(`MISSING_REQUIRED_ENV:${routingDeploymentEnvironmentVariable}`),
    true
  );
});

test("worker test mode requires application-owned routing deployment configuration", async () => {
  mkdirSync(scratchRoot, { recursive: true });
  const queueFile = join(scratchRoot, "routing-queue.json");
  writeFileSync(
    queueFile,
    JSON.stringify([
      {
        messageId: "routing-m1",
        tenantId: "tenant-a",
        caseId: "case-a",
        queueName: "q-ingestion",
        operation: "REQUEST_INGESTION",
        payloadReference: "blob://payload",
        idempotencyKey: "routing-idem-1",
        correlationId: "routing-corr-1",
        evidenceId: "routing-ev-1"
      }
    ]),
    "utf8"
  );

  try {
    const child = launch(resolve(distRoot, "worker-main.js"), {
      APP_ENV: "tst",
      ROLLOUT_ADMISSION_MAX: "20",
      LOG_LEVEL: "INFO",
      MODEL_PROVIDER_EVIDENCE_ID: "model",
      PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt",
      MODEL_ROUTING_POLICY_VERSION: "stratton-model-routing-v1",
      WORKER_MODE: "test",
      ALLOW_TEST_ADAPTERS: "true",
      WORKER_QUEUE_NAME: "q-ingestion",
      WORKER_TEST_QUEUE_FILE: queueFile,
      WORKER_MAX_CYCLES: "3",
      WORKER_RECEIVE_WAIT_MS: "5"
    });
    const result = await waitForExitOrTimeout(child, 1_000);
    assert.equal(result.timedOut, false);
    assert.notEqual(result.code, 0);
    assert.equal(
      result.stderr.includes(`MISSING_REQUIRED_ENV:${routingDeploymentEnvironmentVariable}`),
      true
    );
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
});

test("api production mode fails closed without Azure config", async () => {
  const child = launch(resolve(distRoot, "api-main.js"), {
    APP_ENV: "prd",
    ROLLOUT_ADMISSION_MAX: "20",
    LOG_LEVEL: "INFO",
    MODEL_PROVIDER_EVIDENCE_ID: "model",
    PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt",
    MODEL_ROUTING_POLICY_VERSION: "stratton-model-routing-v1",
    [routingDeploymentEnvironmentVariable]: modelRouteDeploymentsJson,
    API_PORT: "40101",
    API_RUNTIME_MODE: "production"
  });

  test("api production mode rejects blocked capability overrides", async () => {
    const child = launch(resolve(distRoot, "api-main.js"), {
      APP_ENV: "prd",
      ROLLOUT_ADMISSION_MAX: "20",
      LOG_LEVEL: "INFO",
      MODEL_PROVIDER_EVIDENCE_ID: "model",
      PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt",
      MODEL_ROUTING_POLICY_VERSION: "stratton-model-routing-v1",
      [routingDeploymentEnvironmentVariable]: modelRouteDeploymentsJson,
      API_PORT: "40102",
      API_RUNTIME_MODE: "production",
      ANALYSIS_CAPABILITY_ENABLED: "true"
    });
    const result = await waitForExit(child);
    assert.notEqual(result.code, 0);
    assert.equal(result.stderr.includes("BLOCKED_CAPABILITY_OVERRIDE"), true);
  });
  const result = await waitForExit(child);
  assert.notEqual(result.code, 0);
});

test("worker production mode fails closed without Azure config", async () => {
  const child = launch(resolve(distRoot, "worker-main.js"), {
    APP_ENV: "prd",
    ROLLOUT_ADMISSION_MAX: "20",
    LOG_LEVEL: "INFO",
    MODEL_PROVIDER_EVIDENCE_ID: "model",
    PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt",
    MODEL_ROUTING_POLICY_VERSION: "stratton-model-routing-v1",
    [routingDeploymentEnvironmentVariable]: modelRouteDeploymentsJson,
    WORKER_MODE: "production",
    WORKER_QUEUE_NAME: "q-ingestion"
  });

  test("worker production mode blocks unapproved analysis/vectorization/export queues", async () => {
    for (const queueName of ["q-analysis", "q-indexing", "q-audit-export"] as const) {
      const child = launch(resolve(distRoot, "worker-main.js"), {
        APP_ENV: "prd",
        ROLLOUT_ADMISSION_MAX: "20",
        LOG_LEVEL: "INFO",
        MODEL_PROVIDER_EVIDENCE_ID: "model",
        PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt",
        MODEL_ROUTING_POLICY_VERSION: "stratton-model-routing-v1",
        [routingDeploymentEnvironmentVariable]: modelRouteDeploymentsJson,
        WORKER_MODE: "production",
        WORKER_QUEUE_NAME: queueName
      });
      const result = await waitForExit(child);
      assert.notEqual(result.code, 0);
      const expected =
        queueName === "q-analysis"
          ? "BLOCKED_ANALYSIS_CONTRACT_UNAPPROVED"
          : queueName === "q-indexing"
            ? "BLOCKED_VECTORIZATION_CONTRACT_UNAPPROVED"
            : "BLOCKED_AUDIT_EXPORT_CONTRACT_UNAPPROVED";
      assert.equal(result.stderr.includes(expected), true);
    }
  });
  const result = await waitForExit(child);
  assert.notEqual(result.code, 0);
});

test("api test mode serves readiness and health", async () => {
  const port = 41000 + Math.floor(Math.random() * 1000);
  const child = launch(resolve(distRoot, "api-main.js"), {
    APP_ENV: "tst",
    ROLLOUT_ADMISSION_MAX: "20",
    LOG_LEVEL: "INFO",
    MODEL_PROVIDER_EVIDENCE_ID: "model",
    PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt",
    MODEL_ROUTING_POLICY_VERSION: "stratton-model-routing-v1",
    [routingDeploymentEnvironmentVariable]: modelRouteDeploymentsJson,
    API_PORT: `${port}`,
    API_RUNTIME_MODE: "test",
    ALLOW_TEST_ADAPTERS: "true"
  });
  try {
    let healthResponse: Response | undefined;
    let readinessResponse: Response | undefined;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
      try {
        healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
        readinessResponse = await fetch(`http://127.0.0.1:${port}/readiness`);
        break;
      } catch {
        continue;
      }
    }
    assert.ok(healthResponse);
    assert.ok(readinessResponse);
    assert.equal(healthResponse.status, 200);
    assert.equal(readinessResponse.status, 200);
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await waitForExit(child);
    }
  }
});

test("worker test mode processes configured queue file", async () => {
  mkdirSync(scratchRoot, { recursive: true });
  const queueFile = join(scratchRoot, "queue.json");
  writeFileSync(
    queueFile,
    JSON.stringify([
      {
        messageId: "m1",
        tenantId: "tenant-a",
        caseId: "case-a",
        queueName: "q-ingestion",
        operation: "REQUEST_INGESTION",
        payloadReference: "blob://payload",
        idempotencyKey: "idem-1",
        correlationId: "corr-1",
        evidenceId: "ev-1"
      }
    ]),
    "utf8"
  );

  const child = launch(resolve(distRoot, "worker-main.js"), {
    APP_ENV: "tst",
    ROLLOUT_ADMISSION_MAX: "20",
    LOG_LEVEL: "INFO",
    MODEL_PROVIDER_EVIDENCE_ID: "model",
    PROMPT_GOVERNANCE_EVIDENCE_ID: "prompt",
    MODEL_ROUTING_POLICY_VERSION: "stratton-model-routing-v1",
    [routingDeploymentEnvironmentVariable]: modelRouteDeploymentsJson,
    WORKER_MODE: "test",
    ALLOW_TEST_ADAPTERS: "true",
    WORKER_QUEUE_NAME: "q-ingestion",
    WORKER_TEST_QUEUE_FILE: queueFile,
    WORKER_MAX_CYCLES: "3",
    WORKER_RECEIVE_WAIT_MS: "5"
  });
  const result = await waitForExit(child);
  rmSync(scratchRoot, { recursive: true, force: true });
  assert.equal(result.code, 0, result.stderr);
});
