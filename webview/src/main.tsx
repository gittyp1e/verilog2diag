import React from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Blueprint webview root element was not found.");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
