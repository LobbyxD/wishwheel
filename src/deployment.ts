/// <reference types="vite/client" />
// Vercel proxies this dedicated namespace to the existing deployed Worker.
// A same-origin path keeps Google session cookies first-party, including Safari.
// It also avoids the older /api/room setup-guard function.
export const apiEndpoint = import.meta.env?.DEV ? '/api/room' : '/api/wishwheel/room';
export const authEndpoint = import.meta.env?.DEV ? '/api/auth' : '/api/wishwheel/auth';
