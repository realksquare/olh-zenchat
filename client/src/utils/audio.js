let sharedCtx = null;

export function getAudioContext() {
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

let currentIntroNodes = [];
let masterGainNode = null;
let recordingDestination = null;

export const setRecordingDestination = (dest) => {
    recordingDestination = dest;
};

export const startZenIntroAudio = () => {
    stopZenIntroAudio();
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        masterGainNode = ctx.createGain();
        masterGainNode.gain.setValueAtTime(0, ctx.currentTime);
        masterGainNode.connect(ctx.destination);
        if (recordingDestination) {
            try {
                masterGainNode.connect(recordingDestination);
            } catch (err) {
                console.warn("Failed to connect masterGainNode to recordingDestination:", err);
            }
        }

        const oscSaw1 = ctx.createOscillator();
        const oscSaw2 = ctx.createOscillator();
        const sawGain = ctx.createGain();
        const sawFilter = ctx.createBiquadFilter();

        oscSaw1.type = "sawtooth";
        oscSaw1.frequency.setValueAtTime(180, ctx.currentTime);
        oscSaw2.type = "sawtooth";
        oscSaw2.frequency.setValueAtTime(183, ctx.currentTime);

        sawFilter.type = "lowpass";
        sawFilter.frequency.setValueAtTime(200, ctx.currentTime);

        sawGain.gain.setValueAtTime(0.03, ctx.currentTime);

        oscSaw1.connect(sawFilter);
        oscSaw2.connect(sawFilter);
        sawFilter.connect(sawGain);
        sawGain.connect(masterGainNode);

        oscSaw1.start(ctx.currentTime);
        oscSaw2.start(ctx.currentTime);
        oscSaw1.stop(ctx.currentTime + 2.5);
        oscSaw2.stop(ctx.currentTime + 2.5);

        masterGainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.5);

        const oscT1 = ctx.createOscillator();
        const oscT2 = ctx.createOscillator();
        const oscT3 = ctx.createOscillator();
        const triadGain = ctx.createGain();
        const triadFilter = ctx.createBiquadFilter();

        oscT1.type = "sine";
        oscT1.frequency.setValueAtTime(110, ctx.currentTime + 2.5);
        oscT2.type = "sine";
        oscT2.frequency.setValueAtTime(165, ctx.currentTime + 2.5);
        oscT3.type = "sine";
        oscT3.frequency.setValueAtTime(220, ctx.currentTime + 2.5);

        triadFilter.type = "lowpass";
        triadFilter.frequency.setValueAtTime(250, ctx.currentTime + 2.5);

        triadGain.gain.setValueAtTime(0.06, ctx.currentTime + 2.5);

        oscT1.connect(triadFilter);
        oscT2.connect(triadFilter);
        oscT3.connect(triadFilter);
        triadFilter.connect(triadGain);
        triadGain.connect(masterGainNode);

        oscT1.start(ctx.currentTime + 2.5);
        oscT2.start(ctx.currentTime + 2.5);
        oscT3.start(ctx.currentTime + 2.5);

        triadFilter.frequency.setValueAtTime(250, ctx.currentTime + 2.5);
        triadFilter.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 4.8);
        triadGain.gain.setValueAtTime(0.06, ctx.currentTime + 2.5);
        triadGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 4.8);

        oscT1.stop(ctx.currentTime + 5.0);
        oscT2.stop(ctx.currentTime + 5.0);
        oscT3.stop(ctx.currentTime + 5.0);

        const oscBloom1 = ctx.createOscillator();
        const oscBloom2 = ctx.createOscillator();
        const bloomGain = ctx.createGain();
        const bloomFilter = ctx.createBiquadFilter();

        oscBloom1.type = "sine";
        oscBloom1.frequency.setValueAtTime(330, ctx.currentTime + 5.0);
        oscBloom2.type = "sine";
        oscBloom2.frequency.setValueAtTime(440, ctx.currentTime + 5.0);

        bloomFilter.type = "lowpass";
        bloomFilter.frequency.setValueAtTime(150, ctx.currentTime + 5.0);
        bloomFilter.frequency.linearRampToValueAtTime(350, ctx.currentTime + 7.5);
        bloomFilter.frequency.linearRampToValueAtTime(150, ctx.currentTime + 10.0);

        bloomGain.gain.setValueAtTime(0, ctx.currentTime + 5.0);
        bloomGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 6.0);
        bloomGain.gain.setValueAtTime(0.05, ctx.currentTime + 8.5);
        bloomGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 10.0);

        oscBloom1.connect(bloomFilter);
        oscBloom2.connect(bloomFilter);
        bloomFilter.connect(bloomGain);
        bloomGain.connect(masterGainNode);

        oscBloom1.start(ctx.currentTime + 5.0);
        oscBloom2.start(ctx.currentTime + 5.0);
        oscBloom1.stop(ctx.currentTime + 10.0);
        oscBloom2.stop(ctx.currentTime + 10.0);

        currentIntroNodes = [
            oscSaw1, oscSaw2, sawGain, sawFilter,
            oscT1, oscT2, oscT3, triadGain, triadFilter,
            oscBloom1, oscBloom2, bloomGain, bloomFilter
        ];
    } catch (e) {
        console.error("Failed to play Zen intro audio:", e);
    }
};

export const stopZenIntroAudio = () => {
    try {
        const ctx = getAudioContext();
        if (masterGainNode && ctx) {
            masterGainNode.gain.cancelScheduledValues(ctx.currentTime);
            masterGainNode.gain.setValueAtTime(masterGainNode.gain.value, ctx.currentTime);
            masterGainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
        }
        const nodes = [...currentIntroNodes];
        currentIntroNodes = [];
        setTimeout(() => {
            nodes.forEach(node => {
                try { node.stop(); } catch (_) {}
                try { node.disconnect(); } catch (_) {}
            });
            if (masterGainNode) {
                try { masterGainNode.disconnect(); } catch (_) {}
                masterGainNode = null;
            }
        }, 1600);
    } catch (e) {
        console.error("Failed to stop Zen intro audio:", e);
    }
};

// Soft ascending blip — confirms voice recording started
export const playVoiceStartTone = () => {
    playTone({ startFreq: 500, endFreq: 800, duration: 0.08, type: "sine", volume: 0.05 });
};

// Soft descending blip — confirms voice recording stopped / sent
export const playVoiceStopTone = () => {
    playTone({ startFreq: 600, endFreq: 300, duration: 0.08, type: "sine", volume: 0.05 });
};
