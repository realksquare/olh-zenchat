/**
 * Returns a proxied URL for a music preview so that browsers can load it
 * without running into CORS restrictions from Deezer/iTunes CDNs.
 */
export function getProxyAudioUrl(previewUrl) {
    if (!previewUrl) return null;
    const base = import.meta.env.VITE_API_URL
        ? `${import.meta.env.VITE_API_URL}/api`
        : '/api';
    return `${base}/music/proxy?url=${encodeURIComponent(previewUrl)}`;
}
