import { SMART_REPLIES, PRESEEDED_BIGRAMS } from './smartReplies';
import { getAutocompleteModel, upsertAutocompleteEntry } from '../db/zenDB';

// --- Internal Utilities ---

function normalize(text) {
    if (!text) return "";
    return text.toLowerCase().replace(/[^\w\s]/g, "").trim();
}

function getTokens(text) {
    return normalize(text).split(/\s+/).filter(Boolean);
}

// Stop words are words that shouldn't trigger next-word predictions (too common)
// We keep this extremely minimal for Indian texting slangs.
const STOP_WORDS = new Set(["a", "an", "the", "to", "is", "of", "and", "in", "it"]);

// --- Exported API ---

export async function loadModel() {
    return await getAutocompleteModel();
}

export async function trainOnMessage(text) {
    const tokens = getTokens(text);
    if (tokens.length === 0) return;

    // Train word completions
    for (const token of tokens) {
        if (token.length >= 3 && !STOP_WORDS.has(token)) {
            await upsertAutocompleteEntry(`w:${token}`, 1);
        }
    }

    // Train next-word bigrams
    for (let i = 0; i < tokens.length - 1; i++) {
        const wordA = tokens[i];
        const wordB = tokens[i + 1];
        if (!STOP_WORDS.has(wordA)) {
            await upsertAutocompleteEntry(`b:${wordA}|${wordB}`, 1);
        }
    }
}

export function getSmartStart(lastReceivedText) {
    if (!lastReceivedText) return null;
    const norm = normalize(lastReceivedText);
    
    // Direct match check against SMART_REPLIES keys
    for (const [trigger, reply] of Object.entries(SMART_REPLIES)) {
        if (norm.includes(trigger)) {
            return reply;
        }
    }
    return null;
}

export function getWordSuggestion(partialWord, model) {
    if (!partialWord || partialWord.length < 3) return null;
    const prefix = partialWord.toLowerCase();
    
    let bestMatch = null;
    let maxCount = 0;

    for (const [key, data] of Object.entries(model)) {
        if (key.startsWith('w:') && key.substring(2).startsWith(prefix)) {
            if (data.count > maxCount) {
                maxCount = data.count;
                bestMatch = key.substring(2);
            }
        }
    }
    
    // Check if the best match is actually what the user typed (case insensitive)
    if (bestMatch && bestMatch === prefix) return null;

    // Preserve original case of the typed part, append the rest
    if (bestMatch) {
        return partialWord + bestMatch.substring(prefix.length);
    }
    return null;
}

export function getNextWordSuggestion(lastWord, model) {
    if (!lastWord) return null;
    const normWord = lastWord.toLowerCase();
    if (STOP_WORDS.has(normWord)) return null;

    let bestMatch = null;
    let maxCount = 0;

    // First check user's trained model (requires count >= 3 for confidence)
    for (const [key, data] of Object.entries(model)) {
        if (key.startsWith(`b:${normWord}|`)) {
            if (data.count >= 3 && data.count > maxCount) {
                maxCount = data.count;
                bestMatch = key.split('|')[1];
            }
        }
    }

    // Fallback to PRESEEDED_BIGRAMS if no strong local match
    if (!bestMatch && PRESEEDED_BIGRAMS[normWord]) {
        bestMatch = PRESEEDED_BIGRAMS[normWord];
    }

    return bestMatch;
}
