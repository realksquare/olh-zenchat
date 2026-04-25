import { useState, useEffect, memo } from "react";

const MusicSearch = ({ onSelect, onClose }) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const searchMusic = async () => {
            if (!query || query.length < 2) return;
            setLoading(true);
            try {
                // iTunes Search (Reliable)
                const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=15`);
                const itunesData = await itunesRes.json();
                const itunesTracks = itunesData.results.map(track => ({
                    id: `itunes-${track.trackId}`,
                    title: track.trackName,
                    artist: track.artistName,
                    previewUrl: track.previewUrl,
                    coverUrl: track.artworkUrl100,
                    totalDuration: Math.floor(track.trackTimeMillis / 1000),
                    source: "iTunes"
                }));

                // Deezer Search via AllOrigins Proxy (To bypass CORS)
                let deezerTracks = [];
                try {
                    const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=10`;
                    const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(deezerUrl)}`);
                    const proxyData = await proxyRes.json();
                    const deezerData = JSON.parse(proxyData.contents);
                    deezerTracks = (deezerData.data || []).map(track => ({
                        id: `deezer-${track.id}`,
                        title: track.title,
                        artist: track.artist.name,
                        previewUrl: track.preview,
                        coverUrl: track.album.cover_medium,
                        totalDuration: track.duration,
                        source: "Deezer"
                    }));
                } catch (e) {
                    console.log("Deezer Proxy Error:", e);
                }

                // Combine and prioritize iTunes then Deezer
                const combined = [...itunesTracks, ...deezerTracks];
                const unique = combined.filter((v, i, a) => 
                    a.findIndex(t => t.title.toLowerCase() === v.title.toLowerCase() && t.artist.toLowerCase() === v.artist.toLowerCase()) === i
                );
                setResults(unique);
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
        <div className="aura-music-search">
            <div className="music-search-header">
                <input 
                    type="text" 
                    placeholder="Search and add track (upto 30s fixed preview)..." 
                    value={query} 
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                />
            </div>
            <div className="music-results">
                {loading ? (
                    <div className="music-loading">Vibing through multisensory catalogs...</div>
                ) : results.length > 0 ? (
                    results.map(track => (
                        <div key={track.id} className="music-track-item" onClick={() => onSelect(track)}>
                            <img src={track.coverUrl} alt="Cover" className="track-cover" />
                            <div className="track-info">
                                <div className="track-name-wrapper">
                                    <span className="track-name">{track.title}</span>
                                    <span className="track-source-tag">{track.source}</span>
                                </div>
                                <span className="track-artist">{track.artist}</span>
                            </div>
                            <div className="track-actions">
                                <button className="select-btn">Select</button>
                            </div>
                        </div>
                    ))
                ) : query.length >= 2 ? (
                    <div className="music-loading">No vibes found matching your breath.</div>
                ) : (
                    <div className="music-loading">Type to explore vibes across catalogs...</div>
                )}
            </div>
            <button className="aura-close-search" onClick={onClose}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
    );
};

export default memo(MusicSearch);
