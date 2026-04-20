let sharedCtx = null;

function getAudioContext() {
    if (!sharedCtx || sharedCtx.state === "closed") {
        sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (sharedCtx.state === "suspended") {
        sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
}

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

        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.setValueAtTime(volume, ctx.currentTime + duration * 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration + 0.01);
    } catch (e) {
    }
}

export const playSendSound = () => {
    playTone({ startFreq: 440, endFreq: 880, duration: 0.1, type: "sine", volume: 0.06 });
};

export const playReceiveSound = () => {
    try {
        const ctx = getAudioContext();
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(880, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.09);
        gain1.gain.setValueAtTime(0.05, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.1);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
        osc2.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.2);
        gain2.gain.setValueAtTime(0.04, ctx.currentTime + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc2.start(ctx.currentTime + 0.1);
        osc2.stop(ctx.currentTime + 0.23);
    } catch (e) {}
};

export const primeAudioContext = () => {
    try { getAudioContext(); } catch (e) {}
};
