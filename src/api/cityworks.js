// All URLs are relative so they resolve correctly on the production server (same origin)
// and are proxied by Vite in development (see vite.config.js).
const CW_API = '/admin/Services/AMS/';

async function cwPost(endpoint, payload, token) {
    // Token is sent in both places:
    // - body param  → current Cityworks versions (<23)
    // - Auth header → Cityworks 23+ (body param no longer accepted)
    // Both can coexist safely, so no code change is needed at upgrade time.
    const res = await fetch(CW_API + endpoint, {
        method: 'POST',
        headers: {
            Authorization: `cityworks ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ data: JSON.stringify(payload), token }),
    });
    return res.json();
}

export async function fetchToken() {
    // BASE_URL, not a bare relative path: the app is deployed under a sub-path,
    // where "token.ashx" would resolve against the wrong directory if the user
    // lands on the URL without a trailing slash.
    const res = await fetch(`${import.meta.env.BASE_URL}token.ashx`, { method: 'POST' });
    const data = await res.json();
    if (!data?.Value?.Token) throw new Error('Cityworks authentication failed');
    return data.Value.Token;
}

export async function fetchProblems(token) {
    const data = await cwPost('ServiceRequest/Problems', { ForPublicOnly: false }, token);
    return data.Value ?? [];
}

export async function fetchQA(problemSid, token) {
    const data = await cwPost('ServiceRequest/QA', { ProblemSid: problemSid }, token);
    return data.Value;
}

export async function createServiceRequest(payload, token) {
    return cwPost('ServiceRequest/Create', payload, token);
}

export async function searchRequests(params, token) {
    const data = await cwPost('ServiceRequest/Search', params, token);
    return data.Value ?? [];
}

export async function fetchRequestsByIds(ids, token) {
    const data = await cwPost('ServiceRequest/ByIds', { RequestIds: ids }, token);
    return data.Value ?? [];
}

export async function fetchRequestById(id, token) {
    const data = await cwPost('ServiceRequest/ById', { RequestId: id }, token);
    return data.Value ?? null;
}
