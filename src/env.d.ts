/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
/** Build timestamp (+ commit SHA once this is a git checkout), stamped at
 *  build time by vite.config.ts — shows when this deploy was actually built. */
declare const __APP_BUILD__: string;
