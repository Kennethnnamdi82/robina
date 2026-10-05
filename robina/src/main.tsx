// 1. THE POLYFILLS MUST BE FIRST
import { Buffer } from "buffer";
// @ts-expect-error Browser polyfill assignment
window.Buffer = Buffer;
// @ts-expect-error Browser polyfill assignment
window.global = window;

import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App.tsx";
import "./index.css";
// NOTE: We are removing Web3Provider from here and moving it into App.tsx
// to fix the "No QueryClient set" error.
import AppErrorBoundary from "./components/AppErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
