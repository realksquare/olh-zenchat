/**
 * Returns a proxied URL for a music preview so that browsers can load it
 * without running into CORS restrictions from Deezer/iTunes CDNs.
 */
export function getProxyAudioUrl(previewUrl) {
    if (!previewUrl) return null;
    const defaultBackend = (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1")
        ? "https://olh-zenchat.onrender.com"
        : "";
    const apiBase = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
        : defaultBackend;
    const base = `${apiBase}/api`;
    return `${base}/music/proxy?url=${encodeURIComponent(previewUrl)}`;
}
