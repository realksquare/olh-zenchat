import { db } from "../db/zenDB";
import axiosInstance from "./axios";
import { useAuthStore } from "../stores/authStore";
import {
    generateUserKeys,
    decryptPrivateKeyWithPassword,
    decryptPrivateKeyWithRecoveryKey,
    decryptMessageContent,
    encryptPrivateKeyWithRecoveryKey
} from "./crypto";

// Generates a high-security random 16-character Recovery Key (e.g. ZNC-X9RT-K4WP-Q2LM)
export const generateRecoveryKey = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excludes easily mistakable characters
    let result = "ZNC-";
    for (let i = 0; i < 3; i++) {
        let chunk = "";
        for (let j = 0; j < 4; j++) {
            chunk += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        result += chunk + (i < 2 ? "-" : "");
    }
    return result;
};

/**
 * Main orchestrator of the zero-knowledge client E2EE lifecycle.
 * Automatically runs during login, signup, or profile load:
 * - Case A (Server Has Key): Downloads encrypted bundle, decrypts with password, and caches locally in IndexedDB.
 * - Case B (Fresh Startup): Generates E2EE keys + a Recovery Key, encrypts, uploads to server, and caches locally.
 * Returns the recovery key if generated, so the UI can prompt the user to write it down.
 */
export const setupE2EEForUser = async (user, password) => {
    if (!db || !db.keys) {
        console.error("[E2EE Helper] IndexedDB not ready or keys store missing");
        return null;
    }

    try {
        // Check if we already have the active keys cached in our local IndexedDB
        const cachedPrivateKey = await db.keys.get("privateKey");
        const cachedPublicKey = await db.keys.get("publicKey");

        if (cachedPrivateKey && cachedPublicKey) {
            console.log("[E2EE] Cryptographic keys are already successfully cached locally.");
            return null;
        }

        // Case A: Server already holds E2EE keys. We download, decrypt, and cache them.
        if (user.publicKey && user.encryptedPrivateKey && user.cryptoSalt) {
            console.log("[E2EE] Server holds keys. Initiating local key decryption and cache sync...");
            const decryptedPrivateKey = await decryptPrivateKeyWithPassword(
                user.encryptedPrivateKey,
                password,
                user.cryptoSalt
            );

            // Export private key back as JWK for offline persistence in IndexedDB
            const privateKeyJWK = await window.crypto.subtle.exportKey("jwk", decryptedPrivateKey);

            await db.keys.put({ key: "privateKey", value: privateKeyJWK });
            await db.keys.put({ key: "publicKey", value: user.publicKey });
            
            console.log("[E2EE] Local key cache successfully synchronized and active!");
            return null;
        }

        // Case B: Brand new user or Clean Slate. We generate new keys.
        console.log("[E2EE] No keys found. Initializing Zero-Knowledge key generation...");
        const recoveryKey = generateRecoveryKey();

        const {
            publicKey,
            encryptedPrivateKey,
            encryptedPrivateKeyBackup,
            cryptoSalt
        } = await generateUserKeys(password, recoveryKey);

        // Upload encrypted bundles to the server
        await axiosInstance.post("/auth/keys", {
            publicKey,
            encryptedPrivateKey,
            encryptedPrivateKeyBackup,
            cryptoSalt
        });

        // Store active keys locally
        const keyPair = await generateUserKeys(password, recoveryKey); // Re-gen or extract raw keys to store
        // To store the private key, we decrypt the encrypted bundle we just generated
        const decryptedPrivateKey = await decryptPrivateKeyWithPassword(
            encryptedPrivateKey,
            password,
            cryptoSalt
        );
        const privateKeyJWK = await window.crypto.subtle.exportKey("jwk", decryptedPrivateKey);

        await db.keys.put({ key: "privateKey", value: privateKeyJWK });
        await db.keys.put({ key: "publicKey", value: publicKey });
        await db.keys.put({ key: "recoveryKey", value: recoveryKey });
        await db.keys.put({ key: "recoveryKeySaved", value: "false" }); // Flag so UI knows to prompt copy

        console.log("[E2EE] E2EE Cryptographic registration and sync fully completed!");
        return recoveryKey;
    } catch (err) {
        console.error("[E2EE Helper] Failed to setup E2EE keys for user:", err);
        throw err;
    }
};

/**
 * Restores historical keys on a fresh device using the offline 16-character Recovery Key.
 * Downloads the encrypted backup bundle from the server, decrypts it, and caches it locally.
 */
export const restoreE2EEWithRecoveryKey = async (user, recoveryKey) => {
    if (!db || !db.keys) throw new Error("Local database not initialized");
    if (!user.encryptedPrivateKeyBackup || !user.cryptoSalt) {
        throw new Error("No E2EE key backup found on the server. Clean Slate is required.");
    }

    try {
        console.log("[E2EE] Attempting private key recovery using offline recovery key...");
        const decryptedPrivateKey = await decryptPrivateKeyWithRecoveryKey(
            user.encryptedPrivateKeyBackup,
            recoveryKey,
            user.cryptoSalt
        );

        const privateKeyJWK = await window.crypto.subtle.exportKey("jwk", decryptedPrivateKey);

        await db.keys.put({ key: "privateKey", value: privateKeyJWK });
        await db.keys.put({ key: "publicKey", value: user.publicKey });
        await db.keys.put({ key: "recoveryKey", value: recoveryKey });
        await db.keys.put({ key: "recoveryKeySaved", value: "true" });
        
        console.log("[E2EE] Cryptographic history fully restored successfully!");
        return true;
    } catch (err) {
        console.error("[E2EE Helper] Recovery Key decryption failed:", err);
        throw new Error("Invalid Recovery Key. Please double-check your code.");
    }
};

/**
 * Fetches the local active E2EE key pair from IndexedDB.
 * Returns imported cryptographically active CryptoKeys.
 */
export const getLocalE2EEKeys = async () => {
    if (!db || !db.keys) return null;

    try {
        const privateKeyJWK = await db.keys.get("privateKey");
        const publicKeyJWK = await db.keys.get("publicKey");

        if (!privateKeyJWK || !publicKeyJWK) return null;

        // Import keys back as active CryptoKeys
        const privateKey = await window.crypto.subtle.importKey(
            "jwk",
            privateKeyJWK.value,
            {
                name: "RSA-OAEP",
                hash: "SHA-256"
            },
            false,
            ["decrypt"]
        );

        return {
            publicKey: publicKeyJWK.value,
            privateKey
        };
    } catch (err) {
        console.error("[E2EE Helper] Failed to load local active keys:", err);
        return null;
    }
};

/**
 * Decrypts an E2EE-locked message in place if required.
 * Safely handles fallback text states if keys are missing or fail.
 */
export const decryptMessageIfNeeded = async (message) => {
    if (message && message.isEncrypted && !message.decrypted && message.content && message.encryptedSymmetricKey && message.iv) {
        try {
            const keys = await getLocalE2EEKeys();
            if (keys && keys.privateKey) {
                let encryptedKeyHex = message.encryptedSymmetricKey;
                try {
                    const keyMap = JSON.parse(message.encryptedSymmetricKey);
                    const currentUserId = useAuthStore.getState().user?._id;
                    if (keyMap && currentUserId && keyMap[currentUserId]) {
                        encryptedKeyHex = keyMap[currentUserId];
                    }
                } catch (_) {
                    // Legacy single key format fallback
                }

                const decryptedContent = await decryptMessageContent(
                    message.content,
                    encryptedKeyHex,
                    message.iv,
                    keys.privateKey
                );
                message.content = decryptedContent;
                message.decrypted = true;
            } else {
                message.content = "[Encrypted message - private key missing]";
            }
        } catch (decErr) {
            console.error("[E2EE Helper] Decryption failed:", decErr);
            message.content = "[Failed to decrypt message]";
        }
    }
    return message;
};

/**
 * Rotates the user's Recovery Key. Generates new Recovery Key,
 * encrypts their active local private key with it, and uploads backup to server.
 */
export const rotateUserRecoveryKey = async (user, newRecoveryKey) => {
    if (!db || !db.keys) throw new Error("Local database not initialized");
    const keys = await getLocalE2EEKeys();
    if (!keys || !keys.privateKey) throw new Error("Local E2EE private key not found");

    const cryptoSalt = user?.cryptoSalt;
    if (!cryptoSalt) throw new Error("User cryptographic salt not found");

    const encryptedPrivateKeyBackup = await encryptPrivateKeyWithRecoveryKey(
        keys.privateKey,
        newRecoveryKey,
        cryptoSalt
    );

    await axiosInstance.put("/auth/keys-backup", {
        encryptedPrivateKeyBackup
    });

    await db.keys.put({ key: "recoveryKey", value: newRecoveryKey });
    await db.keys.put({ key: "recoveryKeySaved", value: "true" });

    return true;
};
