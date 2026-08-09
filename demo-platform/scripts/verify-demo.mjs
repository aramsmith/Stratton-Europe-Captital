import { getExitCode, runVerificationSequence, verificationCommands } from "./verify-demo-lib.mjs";

try {
  await runVerificationSequence({
    cwd: process.cwd(),
    commands: verificationCommands,
    logger: console
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(getExitCode(error));
}
