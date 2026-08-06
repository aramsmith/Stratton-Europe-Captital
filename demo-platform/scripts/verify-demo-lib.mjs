import { access, rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

export const verificationCommands = Object.freeze([
  { command: "npm", args: ["run", "build:packages"] },
  { command: "npm", args: ["run", "lint"] },
  { command: "npm", args: ["run", "typecheck"] },
  { command: "npm", args: ["run", "test"] },
  { command: "npm", args: ["run", "build"] },
  { command: "npx", args: ["playwright", "test"] },
  { command: "az", args: ["bicep", "lint", "--file", "infra/main.bicep"] },
  {
    command: "az",
    args: ["bicep", "build", "--file", "infra/main.bicep"],
    cleanupGeneratedFile: path.join("infra", "main.json")
  },
  {
    command: "az",
    args: [
      "bicep",
      "build-params",
      "--file",
      "infra/parameters/dev.bicepparam",
      "--outfile",
      "infra/parameters/dev.parameters.json"
    ],
    cleanupGeneratedFile: path.join("infra", "parameters", "dev.parameters.json")
  },
  { command: "pwsh", args: ["-NoProfile", "-File", "tests/iac/Invoke-DemoIaCTests.ps1"] }
]);

export async function runVerificationSequence({
  cwd = process.cwd(),
  commands = verificationCommands,
  logger = console
} = {}) {
  for (const command of commands) {
    if (command.cleanupGeneratedFile) {
      await runCommandWithCleanup({ cwd, command, logger });
      continue;
    }

    await runCommand(command, { cwd, logger });
  }
}

async function runCommandWithCleanup({ cwd, command, logger }) {
  const outputFile = path.resolve(cwd, command.cleanupGeneratedFile);
  if (await fileExists(outputFile)) {
    throw withExitCode(
      new Error(
        `${command.cleanupGeneratedFile} already exists before verification. Refusing to overwrite a pre-existing file.`
      ),
      1
    );
  }

  let commandFailure;

  try {
    await runCommand(command, { cwd, logger });
  } catch (error) {
    commandFailure = error;
  }

  try {
    await rm(outputFile, { force: true });
  } catch (cleanupError) {
    if (commandFailure) {
      logger.error?.(
        `Cleanup warning: unable to remove ${command.cleanupGeneratedFile}: ${toErrorMessage(cleanupError)}`
      );
    } else {
      throw withExitCode(cleanupError, 1);
    }
  }

  if (commandFailure) {
    throw commandFailure;
  }
}

async function runCommand(command, { cwd, logger }) {
  const rendered = renderCommand(command.command, command.args);
  logger.log(`
> ${rendered}`);

  await new Promise((resolve, reject) => {
    const child =
      process.platform === "win32"
        ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", buildWindowsCommandLine(command.command, command.args)], {
            cwd,
            stdio: "inherit"
          })
        : spawn(command.command, command.args, {
            cwd,
            stdio: "inherit"
          });

    child.on("error", (error) => {
      reject(withExitCode(error, 1));
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(withExitCode(new Error(`${rendered} terminated with signal ${signal}`), 1));
        return;
      }

      if ((code ?? 1) !== 0) {
        reject(withExitCode(new Error(`${rendered} exited with code ${code ?? 1}`), code ?? 1));
        return;
      }

      resolve(undefined);
    });
  });
}

function buildWindowsCommandLine(command, args) {
  return [command, ...args].map(quoteWindowsArgument).join(" ");
}

function quoteWindowsArgument(value) {
  if (value.length === 0) {
    return '""';
  }

  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/(\*)"/g, "$1$1\"").replace(/(\+)$/g, "$1$1")}"`;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function renderCommand(command, args) {
  return [command, ...args].join(" ");
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function withExitCode(error, exitCode) {
  error.exitCode = exitCode;
  return error;
}

export function getExitCode(error) {
  return Number.isInteger(error?.exitCode) ? error.exitCode : 1;
}
