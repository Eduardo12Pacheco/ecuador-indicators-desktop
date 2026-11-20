import "./app/first-paint";
import "./ui/design/fonts.css";
import "./ui/design/tokens.css";
import "./ui/design/base.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { createPorts } from "./app/bootstrap";

async function start() {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Missing #root element");
  }
  const ports = await createPorts();
  createRoot(root).render(
    <StrictMode>
      <App ports={ports} />
    </StrictMode>,
  );
}

void start();
