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

// ── Anti-inspection & protection measures ──

// 1. Disable right-click context menu
document.addEventListener('contextmenu', (e) => e.preventDefault());

// 2. Block common DevTools shortcuts
document.addEventListener('keydown', (e) => {
  // F12
  if (e.key === 'F12') { e.preventDefault(); return; }
  // Ctrl+Shift+I / Cmd+Option+I (Inspect)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') { e.preventDefault(); return; }
  // Ctrl+Shift+J / Cmd+Option+J (Console)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') { e.preventDefault(); return; }
  // Ctrl+Shift+C / Cmd+Option+C (Element picker)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') { e.preventDefault(); return; }
  // Ctrl+U / Cmd+U (View source)
  if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); return; }
  // Ctrl+S / Cmd+S (Save page)
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); return; }
  // Ctrl+Shift+K (Firefox console)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') { e.preventDefault(); return; }
});

// 3. Disable text selection & drag
document.addEventListener('selectstart', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => e.preventDefault());

// 4. Disable copy/cut/paste of page content
document.addEventListener('copy', (e) => e.preventDefault());
document.addEventListener('cut', (e) => e.preventDefault());

// 5. Clear console periodically to hide logs
const clearConsoleLoop = () => {
  try { console.clear(); } catch {}
};
setInterval(clearConsoleLoop, 2000);

// 6. Detect DevTools open via debugger statement (works on most browsers)
const detectDevTools = () => {
  const threshold = 160;
  if (
    window.outerWidth - window.innerWidth > threshold ||
    window.outerHeight - window.innerHeight > threshold
  ) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0f0f0f;color:#fff;font-family:sans-serif;text-align:center;padding:2rem"><div><h1 style="font-size:2rem;margin-bottom:1rem">🔒 Access Denied</h1><p style="color:#999">Developer tools are not allowed on this site.</p></div></div>';
  }
};
setInterval(detectDevTools, 1000);

createRoot(document.getElementById("root")!).render(<App />);
