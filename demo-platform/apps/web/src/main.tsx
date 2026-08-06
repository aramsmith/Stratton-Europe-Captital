import { createRoot } from "react-dom/client";
import { App } from "./app/App.js";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

document.documentElement.style.height = "100%";
document.body.style.height = "100%";
document.body.style.margin = "0";
rootElement.style.height = "100%";

createRoot(rootElement).render(<App />);
