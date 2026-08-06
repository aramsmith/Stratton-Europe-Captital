import { spawn } from "node:child_process";

const commands = [
  ["npm", ["run", "lint"]],
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "test"]],
  ["npm", ["run", "build"]],
  ["npx", ["playwright", "test"]],
  ["az", ["bicep", "build", "--file", "infra/main.bicep"]],
  ["pwsh", ["-NoProfile", "-File", "tests/iac/Invoke-DemoIaCTests.ps1"]]
];

for (const [command, args] of commands) {
  await runCommand(command, args);
}

async function runCommand(command, args) {
  const rendered = [command, ...args].join(" ");
  console.log(`
> ${rendered}`);

  await new Promise((resolve, reject) => {
    const child =
      process.platform === "win32"
        ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", rendered], {
            cwd: process.cwd(),
            stdio: "inherit"
          })
        : spawn(command, args, {
            cwd: process.cwd(),
            stdio: "inherit"
          });

    child.on("error", (error) => {
      reject(error);
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
  }).catch((error) => {
    process.exit(getExitCode(error));
  });
}

function withExitCode(error, exitCode) {
  error.exitCode = exitCode;
  return error;
}

function getExitCode(error) {
  return Number.isInteger(error?.exitCode) ? error.exitCode : 1;
}
