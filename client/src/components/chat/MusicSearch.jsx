import { useState, useEffect, memo } from "react";
import axiosInstance from "../../utils/axios";

const MusicSearch = ({ onSelect, onClose, initialQuery = "" }) => {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const searchMusic = async () => {
            if (!query || query.length < 2) return;
            setLoading(true);
            try {
                const { data } = await axiosInstance.get(`/music/search?q=${encodeURIComponent(query)}`);
                setResults(data);
            } catch (err) {
                console.error("Search error:", err);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(searchMusic, 500);
        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div className="aura-music-search-container">
            <div className="aura-music-search-inner">
                <div className="music-search-header">
                    <input
                        type="text"
                        placeholder="Search track (30s preview)..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={(e) => {
                            setTimeout(() => {
                                e.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 300);
                        }}
                        autoFocus
                    />
                    <button className="aura-remove-music search-close" onClick={onClose}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>
                <div className="music-results">
                    {loading ? (
                        <div className="music-loading">Vibing...</div>
                    ) : results.length > 0 ? (
                        results.map(track => (
                            <div key={track.id} className="music-track-item" onClick={() => onSelect(track)}>
                                <img
                                    src={track.coverUrl || '/default-music.png'}
                                    alt="Cover"
                                    className={`track-cover ${track.source === 'Deezer' ? 'aura-deezer' : track.source === 'iTunes' ? 'aura-itunes' : ''}`}
                                />
                                <div className="track-info" style={{ flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                                    <div className="track-name-scroll" style={{ width: '100%', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                        <span className={track.title.length > 22 ? "marquee-text" : ""} style={{ display: 'inline-block', fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap' }}>
                                            {track.title.replace(/\.\.\.$/, '')}
                                        </span>
                                    </div>
                                    <div className="track-artist-scroll" style={{ width: '100%', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                        <span className={track.artist.length > 26 ? "marquee-text" : ""} style={{ display: 'inline-block', fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                            {track.artist.replace(/\.\.\.$/, '')}
                                        </span>
                                    </div>
                                </div>
                                <button className="select-btn" onClick={(e) => { e.stopPropagation(); onSelect(track); }}>Select</button>
                            </div>
                        ))
                    ) : query.length >= 2 ? (
                        <div className="music-loading">No vibes found.</div>
                    ) : (
                        <div className="music-loading">Type to explore...</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default memo(MusicSearch);
