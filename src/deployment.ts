/// <reference types="vite/client" />
// Public routing metadata, never a credential. Set to the deployed Worker URL
// for production; local Vite uses the local-only /api/room integration harness.
const productionApi = 'https://wishwheel.daniel1233212.workers.dev/api/room';
export const apiEndpoint = import.meta.env?.DEV ? '/api/room' : (productionApi || '/api/room');
