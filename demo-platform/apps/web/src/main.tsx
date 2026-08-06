import ReactDOM from "react-dom/client";
import { appTitle } from "./app.js";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
  <main>
    <h1>{appTitle}</h1>
    <p>Evidence-to-decision demo scaffold.</p>
  </main>
);
