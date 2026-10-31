import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],server:{proxy:process.env.WISHWHEEL_TEST_MODE==='1'?{'/api':{target:`http://127.0.0.1:${process.env.WISHWHEEL_API_PORT||3001}`,ws:true}} :undefined}});
