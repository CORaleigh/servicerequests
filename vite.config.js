import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Vite plugin: handles POST /token.ashx in dev by making a server-side call to
// Cityworks auth with credentials from .env.local. In production, IIS serves
// token.ashx (the C# handler in public/) which reads from web.config appSettings.
function cwTokenMiddleware(username, password) {
    const AUTH_URL = 'https://cityworks.raleighnc.gov/admin/Services/General/Authentication/Authenticate';
    return {
        name: 'cw-token',
        configureServer(server) {
            server.middlewares.use('/token.ashx', async (_req, res) => {
                try {
                    const response = await fetch(AUTH_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            data: JSON.stringify({ LoginName: username, Password: password }),
                        }),
                    });
                    const text = await response.text();
                    res.setHeader('Content-Type', 'application/json');
                    res.end(text);
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
        plugins: [
            react(),
            cwTokenMiddleware(env.CW_USERNAME, env.CW_PASSWORD),
        ],
        server: {
            proxy: {
                // Proxy Cityworks AMS API calls — avoids CORS in dev.
                // In production the app is same-origin with the API server.
                '/admin/': {
                    target: 'https://cityworks.raleighnc.gov',
                    changeOrigin: true,
                },
            },
        },
    };
});
