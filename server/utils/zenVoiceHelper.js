const jwt = require("jsonwebtoken");
const User = require("../models/User");

const ADJECTIVES = [
    "Blue", "Silver", "Crimson", "Phantom", "Neon", "Amber", "Violet", "Scarlet",
    "Jade", "Azure", "Ember", "Frost", "Lunar", "Solar", "Onyx", "Ivory",
    "Cobalt", "Indigo", "Teal", "Coral", "Sage", "Golden", "Shadow", "Storm",
    "Raven", "Crystal", "Blaze", "Arctic", "Dusk", "Dawn", "Nova", "Astral",
    "Iron", "Marble", "Echo", "Mystic", "Rapid", "Silent", "Wild", "Swift"
];

const NOUNS = [
    "Falcon", "Phoenix", "Wolf", "Nova", "Sage", "Comet", "Lynx", "Hawk",
    "Raven", "Tiger", "Dragon", "Viper", "Eagle", "Fox", "Bear", "Panther",
    "Sparrow", "Coyote", "Puma", "Otter", "Elk", "Crane", "Mantis", "Cobra",
    "Condor", "Harpy", "Griffin", "Wren", "Ibis", "Heron", "Osprey", "Kestrel",
    "Cipher", "Vector", "Nexus", "Pulsar", "Quasar", "Orbit", "Signal", "Prism"
];

/**
 * Generates a unique pseudonym (e.g. "BlueFalcon42").
 * Retries until no collision is found in the DB.
 */
const generatePseudonym = async () => {
    let handle, exists;
    let attempts = 0;
    do {
        const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
        const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
        const num = Math.floor(Math.random() * 90) + 10;
        handle = `${adj}${noun}${num}`;
        exists = await User.findOne({ "zenVoice.pseudonym": handle });
        attempts++;
        if (attempts > 100) throw new Error("Could not generate a unique pseudonym. Try again.");
    } while (exists);
    return handle;
};

/**
 * Derives a deterministic HSL color from a pseudonym string.
 * Same pseudonym always produces the same color across all clients.
 */
const getPseudonymColor = (pseudonym) => {
    let hash = 0;
    for (let i = 0; i < pseudonym.length; i++) {
        hash = pseudonym.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 55%)`;
};

/**
 * Issues a short-lived ZenVoice JWT.
 * Payload contains ONLY the pseudonym and college domain — no linkable user info.
 */
const issueZenVoiceToken = (pseudonym, domain) => {
    return jwt.sign(
        { sub: pseudonym, domain: domain || "" },
        process.env.ZENVOICE_JWT_SECRET || process.env.JWT_SECRET || "zenvoice-secret-fallback-key",
        { expiresIn: "12h" }
    );
};

module.exports = { generatePseudonym, getPseudonymColor, issueZenVoiceToken };
