import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const CW_HOST = 'https://cityworks.raleighnc.gov';
const AUTH_PATH = '/admin/Services/General/Authentication/Authenticate';

// Vite plugin: handles POST /token.ashx in dev by making a server-side call to
// Cityworks auth with credentials from .env.local. In production, IIS serves
// token.ashx (the C# handler in public/) which reads from web.config appSettings.
function cwTokenMiddleware(username, password) {
    return {
        name: 'cw-token',
        configureServer(server) {
            server.middlewares.use('/token.ashx', async (_req, res) => {
                res.setHeader('Content-Type', 'application/json');
                if (!username || !password) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({
                        error: 'CW_USERNAME / CW_PASSWORD are not set. Copy .env.example to .env.local.',
                    }));
                    return;
                }
                try {
                    const response = await fetch(CW_HOST + AUTH_PATH, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            data: JSON.stringify({ LoginName: username, Password: password }),
                        }),
                    });
                    res.end(await response.text());
                } catch (err) {
                    res.statusCode = 502;
                    res.end(JSON.stringify({ error: 'Token proxy failed', detail: err.message }));
                }
            });
        },
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        // The production site lives in a sub-path (an IIS application), so built
        // asset URLs must be prefixed with it. Read at runtime via
        // import.meta.env.BASE_URL — see src/api/cityworks.js and Footer.jsx.
        // Override with BASE_PATH when deploying somewhere else; must end in "/".
        base: mode === 'production' ? (env.BASE_PATH || '/servicerequests/') : '/',
        plugins: [
            react(),
            cwTokenMiddleware(env.CW_USERNAME, env.CW_PASSWORD),
        ],
        server: {
            proxy: {
                // Proxy Cityworks AMS API calls — avoids CORS in dev.
                // In production the app is same-origin with the API server.
                '/admin/': {
                    target: CW_HOST,
                    changeOrigin: true,
                },
            },
        },
    };
});
