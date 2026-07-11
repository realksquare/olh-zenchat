import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';
import './VideoPlayer.css';

const VideoPlayer = forwardRef(({ src, className = '', style = {}, autoPlay = false, loop = false, muted = false, controls = true, hideCenterPlay = false, onClick, onTimeUpdate, onEnded, onLoadedMetadata }, ref) => {
    const internalRef = useRef(null);
    useImperativeHandle(ref, () => internalRef.current);

    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [isMuted, setIsMuted] = useState(muted);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        setIsMuted(muted);
    }, [muted]);

    useEffect(() => {
        const video = internalRef.current;
        if (!video) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleTimeUpdate = () => {
            if (video.duration) {
                setProgress((video.currentTime / video.duration) * 100);
            }
            if (onTimeUpdate) onTimeUpdate(video);
        };
        const handleLoadedMetadata = () => {
            setDuration(video.duration);
            if (onLoadedMetadata) onLoadedMetadata(video);
        };
        const handleEnded = () => {
            setIsPlaying(false);
            if (onEnded) onEnded();
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('ended', handleEnded);
        };
    }, [onTimeUpdate, onEnded, onLoadedMetadata]);

    const togglePlay = (e) => {
        if (e) {
            e.stopPropagation();
            if (e.target.closest('.video-player-controls')) return;
        }
        const video = internalRef.current;
        if (!video) return;
        if (video.paused) {
            video.play().catch(() => {});
        } else {
            video.pause();
        }
    };

    const toggleMute = (e) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        const video = internalRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setIsMuted(video.muted);
    };

    const handleSeek = (e) => {
        if (e) e.stopPropagation();
        const video = internalRef.current;
        if (!video) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        video.currentTime = pos * video.duration;
    };

    const toggleFullScreen = (e) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        const video = internalRef.current;
        if (!video) return;
        try {
            if (video.requestFullscreen) {
                video.requestFullscreen().catch((err) => {
                    console.warn("Fullscreen request failed:", err);
                });
            } else if (video.webkitRequestFullscreen) {
                video.webkitRequestFullscreen();
            } else if (video.webkitEnterFullscreen) {
                video.webkitEnterFullscreen();
            }
        } catch (err) {
            console.warn("Fullscreen toggle failed:", err);
        }
    };

    return (
        <div 
            className={`video-player-container ${className}`} 
            style={style}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={(e) => {
                if (e.target.closest('.video-player-controls')) return;
                if (onClick) onClick(e);
                else togglePlay(e);
            }}
        >
            <video
                ref={internalRef}
                src={src}
                className="video-player-element"
                autoPlay={autoPlay}
                loop={loop}
                muted={isMuted}
                playsInline
            />
            
            {controls && (
                <div className={`video-player-controls ${isHovered || !isPlaying ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>
                    <button className="vp-btn vp-play" onClick={togglePlay}>
                        {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: '2px' }} />}
                    </button>
                    
                    <div className="vp-progress-bar" onClick={handleSeek}>
                        <div className="vp-progress-fill" style={{ width: `${progress}%` }}>
                            <div className="vp-progress-knob" />
                        </div>
                    </div>

                    <button className="vp-btn vp-mute" onClick={toggleMute}>
                        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <button className="vp-btn vp-fullscreen" onClick={toggleFullScreen}>
                        <Maximize size={16} />
                    </button>
                </div>
            )}
            
            {!controls && !isPlaying && !autoPlay && !hideCenterPlay && (
                <div className="video-player-center-play">
                    <Play size={32} fill="white" />
                </div>
            )}
        </div>
    );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
