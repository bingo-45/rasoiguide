import "@fontsource/mukta/400.css";
import "@fontsource/mukta/500.css";
import "@fontsource/mukta/600.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/tiro-devanagari-hindi/400.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./styles.css";

// Register the service worker only after the first paint has settled so the
// ~2 MB precache never competes with hero photos and fonts on slow networks.
const registerWhenIdle = () => {
  window.setTimeout(() => registerSW({ immediate: true }), 6000);
};
if (document.readyState === "complete") registerWhenIdle();
else window.addEventListener("load", registerWhenIdle, { once: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
