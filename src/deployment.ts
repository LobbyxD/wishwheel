/// <reference types="vite/client" />
// Vercel proxies this dedicated namespace to the existing deployed Worker.
// A same-origin path keeps Google session cookies first-party, including Safari.
// It also avoids the older /api/room setup-guard function.
export const apiEndpoint = import.meta.env?.DEV ? '/api/room' : '/api/wishwheel/room';
export const authEndpoint = import.meta.env?.DEV ? '/api/auth' : '/api/wishwheel/auth';
export const liveTicketEndpoint = import.meta.env?.DEV ? '/api/live-ticket' : '/api/wishwheel/live-ticket';
export const liveSocketEndpoint = import.meta.env?.DEV ? null : 'wss://wishwheel.daniel1233212.workers.dev/api/live';
