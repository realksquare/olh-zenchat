import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { createPortal } from "react-dom";

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || "pnshJZOMgBP3OVpZzo4TCXPf99zhNIQA";

const GifPicker = ({ onClose, onSelect, initialQuery = "" }) => {
    const [query, setQuery] = useState(initialQuery);
    const [type, setType] = useState("gifs"); // "gifs" or "stickers"
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const loadingRef = useRef(false);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const LIMIT = 12; // Fetch 12 at a time (4 rows of 3)
    const observerRef = useRef(null);
    const lastElementRef = useRef(null);

    const fetchGifs = useCallback(async (isNewSearch = false) => {
        if (!hasMore && !isNewSearch) return;
        if (loadingRef.current) return;
        
        setLoading(true);
        loadingRef.current = true;
        
        try {
            const currentOffset = isNewSearch ? 0 : offset;
            const endpoint = query.trim() 
                ? `https://api.giphy.com/v1/${type}/search` 
                : `https://api.giphy.com/v1/${type}/trending`;
            
            const params = {
                api_key: GIPHY_API_KEY,
                limit: LIMIT,
                offset: currentOffset,
                rating: "g",
            };
            
            if (query.trim()) {
                params.q = query.trim();
            }

            const res = await axios.get(endpoint, { params });
            const newResults = res.data.data;
            
            setResults(prev => isNewSearch ? newResults : [...prev, ...newResults]);
            setOffset(currentOffset + LIMIT);
            setHasMore(newResults.length === LIMIT && res.data.pagination.total_count > currentOffset + LIMIT);
        } catch (error) {
            console.error("Failed to fetch Giphy data:", error);
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, [query, type, offset, hasMore]);

    // Initial fetch and type/query changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setOffset(0);
            setHasMore(true);
            fetchGifs(true);
        }, 300); // Debounce search
        return () => clearTimeout(timeoutId);
    }, [query, type]);

    // Intersection Observer for infinite scroll
    useEffect(() => {
        if (loading) return;
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                fetchGifs();
            }
        });

        if (lastElementRef.current) {
            observerRef.current.observe(lastElementRef.current);
        }
    }, [loading, hasMore, fetchGifs]);

    return createPortal(
        <div className="modal-overlay gif-picker-overlay" onClick={onClose} style={{ zIndex: 10002 }}>
            <div 
                className="gif-picker-modal" 
                onClick={e => e.stopPropagation()}
            >
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
                        onChange={e => setQuery(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="gif-grid">
                    {results.map((item, index) => {
                        const url = item.images.fixed_height.url;
                        const msgType = type === "stickers" ? "sticker" : "gif";
                        if (results.length === index + 1) {
                            return (
                                <div ref={lastElementRef} key={item.id} className={`gif-grid-item ${type === "stickers" ? "is-sticker" : ""}`} onClick={() => onSelect(url, msgType)}>
                                    <img src={url} alt={item.title} loading="lazy" />
                                </div>
                            );
                        } else {
                            return (
                                <div key={item.id} className={`gif-grid-item ${type === "stickers" ? "is-sticker" : ""}`} onClick={() => onSelect(url, msgType)}>
                                    <img src={url} alt={item.title} loading="lazy" />
                                </div>
                            );
                        }
                    })}
                    {loading && (
                        <div className="gif-loading">
                            <div className="loader-sm" />
                        </div>
                    )}
                    {!loading && results.length === 0 && (
                        <div className="gif-empty">No results found</div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default GifPicker;
