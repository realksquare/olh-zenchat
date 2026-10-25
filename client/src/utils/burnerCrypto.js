/**
 * ZenChat Burner Bridge Cryptographic Module
 * Zero-Knowledge AES-256-GCM encryption in RAM only.
 * The encryption key stays in the URL hash fragment (#key) and is never transmitted to the server.
 */

const bytesToHex = (bytes) => {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};

const hexToBytes = (hex) => {
    if (!hex || hex.length % 2 !== 0) return new Uint8Array(0);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
};

// In-memory CryptoKey cache to avoid re-importing the same key on every message
const keyCache = new Map();

/**
 * Generates a fresh cryptographically secure 256-bit symmetric AES key in hex format.
 */
export const generateBurnerSecretKey = async () => {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error("Web Crypto API is not available");
    }
    const key = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const raw = await window.crypto.subtle.exportKey("raw", key);
    return bytesToHex(new Uint8Array(raw));
};

/**
 * Imports a raw hex key string as an active AES-GCM CryptoKey.
 */
export const importBurnerKey = async (keyHex) => {
    if (!keyHex) throw new Error("Key is missing");
    if (keyCache.has(keyHex)) {
        return keyCache.get(keyHex);
    }
    const keyBytes = hexToBytes(keyHex);
    const imported = await window.crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
    keyCache.set(keyHex, imported);
    return imported;
};

/**
 * Encrypts a message using AES-256-GCM.
 * Generates a fresh unique 12-byte IV for every message.
 */
export const encryptBurnerMessage = async (plaintext, keyHex) => {
    try {
        const cryptoKey = await importBurnerKey(keyHex);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const data = encoder.encode(plaintext);

        const ciphertextBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            cryptoKey,
            data
        );

        return {
            ciphertext: bytesToHex(new Uint8Array(ciphertextBuffer)),
            iv: bytesToHex(iv),
        };
    } catch (err) {
        console.error("[BurnerCrypto] Encryption failed:", err);
        throw err;
    }
};

/**
 * Decrypts a message using AES-256-GCM.
 */
export const decryptBurnerMessage = async (ciphertextHex, ivHex, keyHex) => {
    try {
        if (!ciphertextHex || !ivHex || !keyHex) return "";
        const cryptoKey = await importBurnerKey(keyHex);
        const iv = hexToBytes(ivHex);
        const ciphertext = hexToBytes(ciphertextHex);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            cryptoKey,
            ciphertext
        );

        const decoder = new TextDecoder();
        return decoder.decode(decryptedBuffer);
    } catch (err) {
        console.warn("[BurnerCrypto] Decryption failed:", err);
        return "[Unable to decrypt message]";
    }
};
