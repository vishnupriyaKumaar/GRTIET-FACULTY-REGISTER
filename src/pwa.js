import { useEffect, useState } from "react";

// "Install app" support for every device.
//  * Android / Windows / Linux / ChromeOS / macOS (Chrome, Edge, Brave, Samsung Internet, Opera):
//      the browser fires "beforeinstallprompt" -> one tap installs the app.
//  * iPhone / iPad (Safari, Chrome, Edge, Firefox on iOS): Apple has no install prompt,
//      so we show the exact Share -> "Add to Home Screen" steps.
//  * Firefox on a computer / Safari on Mac: we show the matching steps (or the browser to use).
let deferred = null;
let installedNow = false;
const listeners = new Set();
const ping = () => listeners.forEach((f) => f());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; ping(); });
  window.addEventListener("appinstalled", () => { deferred = null; installedNow = true; ping(); });
}

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: window-controls-overlay)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches ||
    window.navigator.standalone === true);

// -> { os: 'ios'|'android'|'windows'|'mac'|'linux'|'chromeos'|'other', browser: 'chrome'|'edge'|'safari'|'firefox'|'samsung'|'opera'|'brave'|'other', inApp: boolean }
export function detectPlatform() {
  if (typeof navigator === "undefined") return { os: "other", browser: "other", inApp: false };
  const ua = navigator.userAgent || "";
  const touchMac = /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;     // iPadOS reports itself as a Mac
  let os = "other";
  if (/iPhone|iPad|iPod/.test(ua) || touchMac) os = "ios";
  else if (/Android/.test(ua)) os = "android";
  else if (/CrOS/.test(ua)) os = "chromeos";
  else if (/Windows/.test(ua)) os = "windows";
  else if (/Macintosh|Mac OS X/.test(ua)) os = "mac";
  else if (/Linux|X11/.test(ua)) os = "linux";
  let browser = "other";
  if (/SamsungBrowser/.test(ua)) browser = "samsung";
  else if (/EdgiOS|EdgA|Edg\//.test(ua)) browser = "edge";
  else if (/OPR\/|OPiOS|Opera/.test(ua)) browser = "opera";
  else if (/FxiOS|Firefox/.test(ua)) browser = "firefox";
  else if (/CriOS|Chrome|Chromium/.test(ua)) browser = navigator.brave ? "brave" : "chrome";
  else if (/Safari/.test(ua)) browser = "safari";
  const inApp = /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|Twitter|LinkedInApp|MicroMessenger|; wv\)/i.test(ua);
  return { os, browser, inApp };
}

export function usePwaInstall() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); listeners.add(f); return () => listeners.delete(f); }, []);
  return {
    installed: installedNow || isStandalone(),
    canInstall: !!deferred && !isStandalone(),
    // true = the browser's own install dialog was shown (and accepted), false = not available / dismissed
    install: async () => {
      if (!deferred) return false;
      const d = deferred;
      d.prompt();
      let ok = false;
      try { ok = (await d.userChoice)?.outcome === "accepted"; } catch { /* ignore */ }
      deferred = null; ping();
      return ok;
    },
  };
}

export function registerServiceWorker() {
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => { setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000); })   // look for a new version every hour
        .catch(() => {});
    });
  }
}
