import { defineStore } from 'pinia';
import { ref } from 'vue';

// Long-lived tabs are the normal usage pattern here (a warehouse/kiosk device
// left on the Scan page for a whole shift) — vue-router never does a full
// navigation back to index.html, so a tab can keep running a bundle built
// hours before the server's current deployment with nothing to prompt a
// reload. This poll (plus a check on every tab-focus) is what catches that.
const POLL_INTERVAL_MS = 10 * 60 * 1000;
const CURRENT_BUILD = __APP_BUILD__;
const BUILD_META_PATTERN = /<meta name="app-build" content="([^"]*)"/;

export const useAppUpdateStore = defineStore('appUpdate', () => {
  const updateAvailable = ref(false);
  const latestBuild = ref<string | null>(null);

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let started = false;

  async function checkNow(): Promise<void> {
    try {
      // "/" — not a dedicated version.json — so this reuses the exact
      // no-store, no-cache response nginx already serves for the SPA shell
      // (see vite.config.ts's buildMetaPlugin) instead of needing a second
      // static asset to keep from ever being cached.
      const res = await fetch(`/?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const html = await res.text();
      const serverBuild = html.match(BUILD_META_PATTERN)?.[1];
      if (serverBuild && serverBuild !== CURRENT_BUILD) {
        latestBuild.value = serverBuild;
        updateAvailable.value = true;
      }
    } catch {
      // Offline or a transient blip — never surface this as an error, the
      // next poll or focus-triggered check will just try again.
    }
  }

  // Pinia stores are already singletons, but App.vue's onMounted can still
  // re-run across hot reloads in dev — `started` keeps that from stacking
  // up duplicate intervals/listeners.
  //
  // A device with this app added to the home screen (Chrome's "Install" /
  // "Add to Shortcut") is exactly the case the poll above can't reach: once
  // backgrounded, Android throttles or fully suspends JS timers, so the
  // 10-minute interval effectively doesn't run until the user is back in the
  // app anyway — reopening it is what has to trigger the check, not the
  // timer. visibilitychange covers most of that, but isn't guaranteed to
  // fire for every way Android resumes a suspended session, so two more
  // standard resume signals back it up: `pageshow` with `persisted: true`
  // (the page was restored from the back/forward cache rather than freshly
  // loaded — the common case for "reopened after being backgrounded a
  // while") and a plain `focus` (some installed/shortcut launch surfaces
  // fire window focus more reliably than document visibilitychange).
  function start(): void {
    if (started) return;
    started = true;
    checkNow();
    pollTimer = setInterval(checkNow, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkNow();
    });
    window.addEventListener('pageshow', (ev) => {
      if (ev.persisted) checkNow();
    });
    window.addEventListener('focus', checkNow);
  }

  function stop(): void {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    started = false;
  }

  function applyUpdate(): void {
    window.location.reload();
  }

  return { updateAvailable, latestBuild, start, stop, checkNow, applyUpdate };
});
