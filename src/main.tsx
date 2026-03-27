import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global error handlers to prevent silent crashes
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

// ── Anti-inspection — reads from DB setting via localStorage cache ──
function applyAntiInspection() {
  if (!import.meta.env.PROD) return;
  
  // Check cached setting (updated by useSiteSettings hook)
  const cached = localStorage.getItem('site_anti_inspection');
  if (cached === 'false') return;

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F12') { e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) { e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); return; }
  });
}
applyAntiInspection();

createRoot(document.getElementById("root")!).render(<App />);
