import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

createRoot(document.getElementById("root")!).render(<App />);

// PWA : enregistrement du service worker généré par vite-plugin-pwa
// autoUpdate → mise à jour silencieuse en background (nouveau SW actif au refresh)
registerSW({
  immediate: true,
  onRegisterError(err) {
    console.warn("SW registration failed:", err);
  },
});
