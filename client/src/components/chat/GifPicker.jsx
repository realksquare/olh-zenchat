import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import axiosInstance from "../../utils/axios";
import { getFavMedia, getRecentMedia, addFavMedia, removeFavMedia, addRecentMedia } from "../../utils/mediaStorage";

const LIMIT = 9;
const MAX_RETRIES = 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GifPicker = ({ onClose, onSelect, initialQuery = "" }) => {
    const [query, setQuery] = useState(initialQuery);
    const [type, setType] = useState("gifs"); // "gifs" or "stickers"
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const abortRef = useRef(null);
    const loadingRef = useRef(false);
    const observerRef = useRef(null);
    const lastElementRef = useRef(null);

    const fetchGifs = useCallback(async (isNewSearch = false, currentOffset = 0) => {
        if (!isNewSearch && loadingRef.current) return;
        if (!isNewSearch && !hasMore) return;

        if (isNewSearch && abortRef.current) {
            abortRef.current.abort();
        }
        abortRef.current = new AbortController();
        const { signal } = abortRef.current;

        setLoading(true);
        setError(null);
        loadingRef.current = true;

        const endpoint = query.trim()
            ? `/giphy/${type}/search`
            : `/giphy/${type}/trending`;

        const params = {
            limit: LIMIT,
            offset: currentOffset,
            rating: "g",
            ...(query.trim() ? { q: query.trim() } : {}),
        };

        let lastErr = null;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (signal.aborted) break;
            try {
                if (attempt > 0) await sleep(400 * attempt);
                const res = await axiosInstance.get(endpoint, { params, signal });
                if (signal.aborted) break;

                const newResults = res.data?.data ?? [];
                const totalCount = res.data?.pagination?.total_count ?? 0;

                setResults((prev) => (isNewSearch ? newResults : [...prev, ...newResults]));
                const nextOffset = currentOffset + LIMIT;
                setOffset(nextOffset);
                // Hard-cap online queries to 9 items — never load more pages
                setHasMore(false);
                lastErr = null;
                break;
            } catch (err) {
                if (err?.code === "ERR_CANCELED" || signal.aborted) break;
                lastErr = err;
                console.warn(`[GifPicker] Fetch attempt ${attempt + 1} failed:`, err.message);
            }
        }

        if (lastErr && !signal.aborted) {
            setError("Couldn't load results. Tap to retry.");
            if (isNewSearch) setResults([]);
        }

        setLoading(false);
        loadingRef.current = false;
    }, [query, type, hasMore]);

    // Reset and fetch on query/type change
    useEffect(() => {
        setResults([]);
        setOffset(0);
        setHasMore(true);
        setError(null);

        if (type === "recents") {
            setResults(getRecentMedia());
            setHasMore(false);
            return;
        }
        if (type === "favs") {
            setResults(getFavMedia());
            setHasMore(false);
            return;
        }

        const timeoutId = setTimeout(() => {
            fetchGifs(true, 0);
        }, 350);

        return () => {
            clearTimeout(timeoutId);
            if (abortRef.current) abortRef.current.abort();
        };
    }, [query, type]); // eslint-disable-line react-hooks/exhaustive-deps

    // Infinite scroll via IntersectionObserver
    useEffect(() => {
        if (loading) return;
        observerRef.current?.disconnect();

        observerRef.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
                fetchGifs(false, offset);
            }
        });

        if (lastElementRef.current) {
            observerRef.current.observe(lastElementRef.current);
        }

        return () => observerRef.current?.disconnect();
    }, [loading, hasMore, offset]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRetry = () => {
        setError(null);
        fetchGifs(true, 0);
    };

    const handleSelect = (url, msgType) => {
        addRecentMedia({ id: url, title: 'Recent', type: msgType, images: { fixed_height: { url } } });
        onSelect(url, msgType);
    };

    const toggleFav = (item, msgType, e) => {
        if (e) e.stopPropagation();
        const url = item.images?.fixed_height?.url;
        if (!url) return;
        
        const favs = getFavMedia();
        if (favs.some(f => f.images?.fixed_height?.url === url)) {
            removeFavMedia(url);
            if (type === "favs") setResults(getFavMedia());
        } else {
            addFavMedia({ id: item.id || url, title: item.title || 'Fav', type: msgType, images: { fixed_height: { url } } });
            if (type === "favs") setResults(getFavMedia());
        }
    };

    const handleItemInteraction = (e, item, msgType) => {
        const url = item.images?.fixed_height?.url;
        if (!url) return;
        
        const now = Date.now();
        const lastTap = e.currentTarget.dataset.lastTap ? parseInt(e.currentTarget.dataset.lastTap) : 0;
        
        if (now - lastTap < 300) {
            clearTimeout(e.currentTarget.selectTimeout);
            e.currentTarget.dataset.lastTap = 0;
            toggleFav(item, msgType);
        } else {
            e.currentTarget.dataset.lastTap = now;
            e.currentTarget.selectTimeout = setTimeout(() => {
                handleSelect(url, msgType);
            }, 300);
        }
    };

    return createPortal(
        <div className="modal-overlay gif-picker-overlay" onClick={onClose} style={{ zIndex: 200000 }}>
            <div className="gif-picker-modal" onClick={(e) => e.stopPropagation()}>
                <div className="gif-picker-header">
                    <div className="gif-tabs">
                        <button className={`gif-tab ${type === "gifs" ? "active" : ""}`} onClick={() => setType("gifs")}>GIFs</button>
                        <button className={`gif-tab ${type === "stickers" ? "active" : ""}`} onClick={() => setType("stickers")}>Stickers</button>
                        <button className={`gif-tab ${type === "recents" ? "active" : ""}`} onClick={() => setType("recents")}>Recents</button>
                        <button className={`gif-tab ${type === "favs" ? "active" : ""}`} onClick={() => setType("favs")}>Favs</button>
                    </div>
                    <button className="aura-close-btn" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {type !== "recents" && type !== "favs" && (
                    <div className="gif-search-container">
                        <svg className="gif-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            className="gif-search-input"
                            placeholder={`Search ${type}...`}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                )}

                <div className="gif-scroll-wrap">
                    <div className="gif-grid">
                        {results.map((item, index) => {
                            const url = item.images?.fixed_height?.url;
                            if (!url) return null;
                            const msgType = item.type || (type === "stickers" ? "sticker" : "gif");
                            const isLast = index === results.length - 1;
                            const isFav = getFavMedia().some(f => f.images?.fixed_height?.url === url);
                            return (
                                <div
                                    ref={isLast ? lastElementRef : null}
                                    key={`${item.id}-${index}`}
                                    className={`gif-grid-item ${msgType === "sticker" ? "is-sticker" : ""}`}
                                    onClick={(e) => handleItemInteraction(e, item, msgType)}
                                    style={{ position: 'relative' }}
                                >
                                    <img src={url} alt={item.title} loading="lazy" />
                                    <button 
                                        className={`gif-fav-btn ${isFav ? 'active' : ''}`}
                                        onClick={(e) => toggleFav(item, msgType, e)}
                                        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(item, msgType, e); }}
                                        title={isFav ? "Remove from Favs" : "Add to Favs"}
                                    >
                                        <svg viewBox="0 0 24 24" fill={isFav ? "#eab308" : "none"} stroke={isFav ? "#eab308" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}

                        {loading && (
                            <div className="gif-loading">
                                <div className="loader-sm" />
                            </div>
                        )}

                        {!loading && error && (
                            <div className="gif-empty" style={{ cursor: "pointer" }} onClick={handleRetry}>
                                {error}
                            </div>
                        )}

                        {!loading && !error && results.length === 0 && (
                            <div className="gif-empty">No results found</div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default GifPicker;
