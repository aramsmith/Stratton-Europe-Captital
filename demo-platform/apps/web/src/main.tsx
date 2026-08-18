import { createRoot } from "react-dom/client";
import { App } from "./app/App.js";
import { createBrowserAuthSession, loadRuntimeAuthConfig } from "./auth/browserAuth.js";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}
const rootContainer = rootElement;

async function bootstrap(): Promise<void> {
  const authSession = await createBrowserAuthSession(await loadRuntimeAuthConfig());
  createRoot(rootContainer).render(<App authSession={authSession} />);
}

void bootstrap().catch(() => {
  rootContainer.textContent = "Microsoft Entra authentication configuration is unavailable.";
});
