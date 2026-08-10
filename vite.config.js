import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_CW_HOST = 'https://cityworks.raleighnc.gov';

// Path segment a Cityworks instance serves its API from. Production uses
// "admin"; the test instance uses "backdoor". Override with CW_PREFIX.
const DEFAULT_CW_PREFIX = 'admin';

// Vite plugin: handles POST /token.ashx in dev by making a server-side call to
// Cityworks auth with credentials from .env.local. In production, IIS serves
// token.ashx (the C# handler in public/) which reads from web.config appSettings.
// Returns the same { Token, ApiBase } shape that handler does.
function cwTokenMiddleware(username, password, cwHost, prefix) {
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
                    const response = await fetch(`${cwHost}/${prefix}/Services/General/Authentication/Authenticate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            data: JSON.stringify({ LoginName: username, Password: password }),
                        }),
                    });
                    const raw = await response.text();

                    // Cityworks answers 200 with Status != 0 on a bad credential,
                    // so a missing token is what marks the failure.
                    let token;
                    try { token = JSON.parse(raw)?.Value?.Token; } catch { /* not JSON */ }
                    if (!token) {
                        res.statusCode = 502;
                        res.end(JSON.stringify({ error: 'Cityworks authentication returned no token: ' + raw }));
                        return;
                    }

                    res.end(JSON.stringify({ Token: token, ApiBase: `/${prefix}/Services/AMS/` }));
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

    // Which Cityworks instance dev talks to, and the path it serves its API
    // from. The token exchange and the API proxy are both built from these, so
    // they can never end up pointing at different servers or different paths.
    const cwHost = env.CW_HOST || DEFAULT_CW_HOST;
    const cwPrefix = (env.CW_PREFIX || DEFAULT_CW_PREFIX).replace(/^\/+|\/+$/g, '');

    return {
        // The production site lives in a sub-path (an IIS application), so built
        // asset URLs must be prefixed with it. Read at runtime via
        // import.meta.env.BASE_URL — see src/api/cityworks.js and Footer.jsx.
        // Override with BASE_PATH when deploying somewhere else; must end in "/".
        base: mode === 'production' ? (env.BASE_PATH || '/servicerequests/') : '/',
        plugins: [
            react(),
            cwTokenMiddleware(env.CW_USERNAME, env.CW_PASSWORD, cwHost, cwPrefix),
        ],
        server: {
            proxy: {
                // Proxy Cityworks AMS API calls — avoids CORS in dev.
                // In production the app is same-origin with the API server.
                [`/${cwPrefix}/`]: {
                    target: cwHost,
                    changeOrigin: true,
                },
            },
        },
    };
});
