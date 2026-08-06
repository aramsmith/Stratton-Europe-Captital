import { getExitCode, runVerificationSequence, verificationCommands } from "./verify-demo-lib.mjs";

try {
  await runVerificationSequence({
    cwd: process.cwd(),
    commands: verificationCommands,
    logger: console
  });
} catch (error) {
  process.exit(getExitCode(error));
}
