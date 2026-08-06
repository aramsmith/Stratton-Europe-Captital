import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    fixture: {
      type: "string",
      default: "baseline"
    },
    "api-base-url": {
      type: "string",
      default: process.env.DEMO_API_BASE_URL ?? "http://127.0.0.1:3001"
    }
  }
});

const fixtureMap = {
  baseline: undefined,
  "prompt-injection": "PROMPT_INJECTION"
};

const fixtureKey = String(values.fixture).toLowerCase();
if (!(fixtureKey in fixtureMap)) {
  console.error(`Unsupported fixture: ${values.fixture}`);
  process.exit(1);
}

const apiBaseUrl = String(values["api-base-url"]).replace(/\/$/, "");
const payload = fixtureMap[fixtureKey];

const response = await fetch(`${apiBaseUrl}/api/scenario/reset`, {
  method: "POST",
  headers: {
    "content-type": "application/json"
  },
  body: JSON.stringify(payload ? { fixture: payload } : {})
});

if (!response.ok) {
  const bodyText = await response.text();
  console.error(`Scenario reset failed with HTTP ${response.status}.`);
  if (bodyText.trim().length > 0) {
    console.error(bodyText);
  }
  process.exit(response.status || 1);
}

const scenario = await response.json();
console.log(
  `Reset ${scenario.caseId} to ${scenario.stage} with ${scenario.evidence.length} evidence items and ${scenario.findings.length} findings.`
);
