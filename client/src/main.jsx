import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext";
import "./index.css";
import App from "./App.jsx";

// Global image load retry fallback for flaky networks
window.addEventListener(
  "error",
  (e) => {
    if (e.target && e.target.tagName === "IMG") {
      const img = e.target;
      const currentSrc = img.src;
      // Skip if the image source is empty or is a local placeholder data URL (like LQIP)
      if (currentSrc && !currentSrc.startsWith("data:") && !currentSrc.includes("img-retry=")) {
        const separator = currentSrc.includes("?") ? "&" : "?";
        img.src = `${currentSrc}${separator}img-retry=${Date.now()}`;
      }
    }
  },
  true // capture phase is required for resource errors
);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <SocketProvider>
        <App />
      </SocketProvider>
    </BrowserRouter>
  </StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').then((registration) => {
      console.log('Service Worker registered with scope:', registration.scope);
    }).catch((err) => {
      console.log('Service Worker registration failed:', err);
    });
  });
}