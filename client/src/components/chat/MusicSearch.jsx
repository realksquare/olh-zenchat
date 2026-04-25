import { useState, useEffect, memo } from "react";

const MusicSearch = ({ onSelect, onClose }) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [previewAudio, setPreviewAudio] = useState(null);

    useEffect(() => {
        const delayDebounce = setTimeout(async () => {
            if (query.trim().length < 2) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=10`);
                const data = await res.json();
                setResults(data.results || []);
            } catch (err) {
                console.error("Music search failed:", err);
            } finally {
                setLoading(false);
            }
        }, 500);
        return () => clearTimeout(delayDebounce);
    }, [query]);

    const handlePreview = (url) => {
        if (previewAudio && previewAudio.src === url) {
            previewAudio.pause();
            setPreviewAudio(null);
            return;
        }
        if (previewAudio) previewAudio.pause();
        const audio = new Audio(url);
        audio.play();
        setPreviewAudio(audio);
    };

    useEffect(() => {
        return () => {
            if (previewAudio) previewAudio.pause();
        };
    }, [previewAudio]);

    return (
        <div className="aura-music-search">
            <div className="music-search-header">
                <input 
                    type="text" 
                    placeholder="Search music vibes..." 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                />
            </div>

            <div className="music-results">
                {loading ? (
                    <div className="music-loading">Searching soundscapes...</div>
                ) : (
                    results.map((track) => (
                        <div key={track.trackId} className="music-track-item">
                            <img src={track.artworkUrl100} alt={track.trackName} className="track-cover" />
                            <div className="track-info">
                                <span className="track-name">{track.trackName}</span>
                                <span className="track-artist">{track.artistName}</span>
                            </div>
                            <div className="track-actions">
                                <button className="preview-btn" onClick={() => handlePreview(track.previewUrl)}>
                                    {previewAudio?.src === track.previewUrl ? "Stop" : "Play"}
                                </button>
                                <button className="select-btn" onClick={() => {
                                    if (previewAudio) previewAudio.pause();
                                    onSelect({
                                        title: track.trackName,
                                        artist: track.artistName,
                                        previewUrl: track.previewUrl,
                                        coverUrl: track.artworkUrl100,
                                        totalDuration: Math.floor(track.trackTimeMillis / 1000)
                                    });
                                }}>
                                    Select
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default memo(MusicSearch);
