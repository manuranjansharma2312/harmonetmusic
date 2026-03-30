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
  
  // Skip in Lovable preview environment
  if (window.location.hostname.includes('lovable.app') || window.location.search.includes('__lovable_token')) return;
  
  // Check cached setting (updated by useSiteSettings hook)
  const cached = localStorage.getItem('site_anti_inspection');
  if (cached === 'false') return;

  // Block right-click
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  
  // Block keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F12') { e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) { e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); return; }
  });

  // Block drag
  document.addEventListener('dragstart', (e) => e.preventDefault());

  // DevTools detection — console.log trick
  const devtoolsCheck = /./;
  let devtoolsOpen = false;
  devtoolsCheck.toString = function() {
    devtoolsOpen = true;
    return '';
  };
  
  setInterval(() => {
    devtoolsOpen = false;
    console.log('%c', devtoolsCheck);
    if (devtoolsOpen) {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#000;color:#fff;font-family:system-ui;text-align:center;padding:2rem"><div><h1 style="font-size:2rem;margin-bottom:1rem">⚠️ Access Denied</h1><p style="opacity:0.7">Developer tools are not allowed on this site.<br/>Source code is protected and hidden.</p></div></div>';
      // Clear all intervals
      for (let i = 1; i < 99999; i++) window.clearInterval(i);
    }
  }, 1000);

  // Block view-source protocol
  if (window.location.protocol === 'view-source:') {
    window.location.href = '/auth';
  }
}
applyAntiInspection();

createRoot(document.getElementById("root")!).render(<App />);
