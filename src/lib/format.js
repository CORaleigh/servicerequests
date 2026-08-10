/**
 * Cityworks returns UTC timestamps like "2026-07-27T14:02:57Z". Render them in
 * the viewer's local time instead of leaking the raw ISO string to the page.
 */
export function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });
}
