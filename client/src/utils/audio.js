/**
 * Shared AudioContext — reuse to avoid "too many contexts" error on mobile
 * Created lazily on first user interaction (browsers require this)
 */
let sharedCtx = null;

function getAudioContext() {
    if (!sharedCtx || sharedCtx.state === "closed") {
        sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (e.g. after page backgrounding)
    if (sharedCtx.state === "suspended") {
        sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
}

/**
 * Play a sound using Web Audio API.
 * Uses AudioContext which bypasses the device media volume on Android PWA
 * (same approach used by WhatsApp Web / Telegram Web).
 * @param {Object} opts
 */
function playTone({ startFreq, endFreq, duration = 0.12, type = "sine", volume = 0.15 }) {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = type;
        osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

        // Slightly louder than before, with a smooth fade-out
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.setValueAtTime(volume, ctx.currentTime + duration * 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration + 0.01);
    } catch (e) {
        // Silently fail — audio is non-critical
    }
}

/**
 * Warm upward "whoosh" — message sent
 */
export const playSendSound = () => {
    playTone({ startFreq: 440, endFreq: 880, duration: 0.1, type: "sine", volume: 0.18 });
};

/**
 * Two-tone descending chime — message received
 */
export const playReceiveSound = () => {
    try {
        const ctx = getAudioContext();
        // First note
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(880, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.09);
        gain1.gain.setValueAtTime(0.15, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.1);

        // Second note (slightly delayed)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
        osc2.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.2);
        gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc2.start(ctx.currentTime + 0.1);
        osc2.stop(ctx.currentTime + 0.23);
    } catch (e) {}
};

/**
 * Pre-warm the AudioContext on first user interaction.
 * Call this once early in the app lifecycle.
 */
export const primeAudioContext = () => {
    try { getAudioContext(); } catch (e) {}
};
