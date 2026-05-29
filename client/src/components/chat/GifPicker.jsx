import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { createPortal } from "react-dom";

const GIPHY_API_KEY = (import.meta.env.VITE_GIPHY_API_KEY || "").trim() || "pnshJZOMgBP3OVpZzo4TCXPf99zhNIQA";
const LIMIT = 12;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GifPicker = ({ onClose, onSelect, initialQuery = "" }) => {
    const [query, setQuery] = useState(initialQuery);
    const [type, setType] = useState("gifs"); // "gifs" or "stickers"
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const abortRef = useRef(null);      // AbortController for in-flight request
    const loadingRef = useRef(false);   // Guard against concurrent scroll fetches
    const observerRef = useRef(null);
    const lastElementRef = useRef(null);

    const fetchGifs = useCallback(async (isNewSearch = false, currentOffset = 0) => {
        if (!isNewSearch && loadingRef.current) return;
        if (!isNewSearch && !hasMore) return;

        // Cancel previous in-flight request on new search
        if (isNewSearch && abortRef.current) {
            abortRef.current.abort();
        }
        abortRef.current = new AbortController();
        const { signal } = abortRef.current;

        setLoading(true);
        setError(null);
        loadingRef.current = true;

        const endpoint = query.trim()
            ? `https://api.giphy.com/v1/${type}/search`
            : `https://api.giphy.com/v1/${type}/trending`;

        const params = {
            api_key: GIPHY_API_KEY,
            limit: LIMIT,
            offset: currentOffset,
            rating: "g",
            ...(query.trim() ? { q: query.trim() } : {}),
        };

        let lastErr = null;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (signal.aborted) break;
            try {
                if (attempt > 0) await sleep(300 * Math.pow(2, attempt - 1)); // exponential backoff
                const res = await axios.get(endpoint, { params, signal });
                if (signal.aborted) break;

                const newResults = res.data?.data ?? [];
                const totalCount = res.data?.pagination?.total_count ?? 0;

                setResults((prev) => (isNewSearch ? newResults : [...prev, ...newResults]));
                const nextOffset = currentOffset + LIMIT;
                setOffset(nextOffset);
                setHasMore(newResults.length === LIMIT && totalCount > nextOffset);
                lastErr = null;
                break; // success
            } catch (err) {
                if (axios.isCancel(err) || signal.aborted) break;
                lastErr = err;
                console.warn(`Giphy fetch attempt ${attempt + 1} failed:`, err.message);
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

    return createPortal(
        <div className="modal-overlay gif-picker-overlay" onClick={onClose} style={{ zIndex: 10002 }}>
            <div className="gif-picker-modal" onClick={(e) => e.stopPropagation()}>
                <div className="gif-picker-header">
                    <div className="gif-tabs">
                        <button
                            className={`gif-tab ${type === "gifs" ? "active" : ""}`}
                            onClick={() => setType("gifs")}
                        >
                            GIFs
                        </button>
                        <button
                            className={`gif-tab ${type === "stickers" ? "active" : ""}`}
                            onClick={() => setType("stickers")}
                        >
                            Stickers
                        </button>
                    </div>
                    <button className="aura-close-btn" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

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

                <div className="gif-scroll-wrap">
                    <div className="gif-grid">
                        {results.map((item, index) => {
                            const url = item.images?.fixed_height?.url;
                            if (!url) return null;
                            const msgType = type === "stickers" ? "sticker" : "gif";
                            const isLast = index === results.length - 1;
                            return (
                                <div
                                    ref={isLast ? lastElementRef : null}
                                    key={item.id}
                                    className={`gif-grid-item ${type === "stickers" ? "is-sticker" : ""}`}
                                    onClick={() => onSelect(url, msgType)}
                                >
                                    <img src={url} alt={item.title} loading="lazy" />
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
