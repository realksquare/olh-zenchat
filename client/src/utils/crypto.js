/**
 * ZenChat Cryptographic Helper Module (Web Crypto API)
 * 
 * Implements high-performance hybrid encryption (RSA-OAEP 2048-bit + AES-GCM 256-bit)
 * for End-to-End Encrypted (E2EE) messaging and secure password recovery.
 */

// Helper to convert ArrayBuffer to Base64
export const arrayBufferToBase64 = (buffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

// Helper to convert Base64 to ArrayBuffer
export const base64ToArrayBuffer = (base64) => {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};

// Helper to convert byte array to hex string
export const bytesToHex = (bytes) => {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};

// Helper to convert hex string to byte array
export const hexToBytes = (hex) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
};

/**
 * Derives a 256-bit AES-GCM key from a plaintext secret (password or recovery key) 
 * using PBKDF2 with 100,000 iterations of HMAC-SHA-256.
 */
const deriveKey = async (secret, saltBytes) => {
    const enc = new TextEncoder();
    const baseKey = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: saltBytes,
            iterations: 100000,
            hash: "SHA-256"
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
};

/**
 * Generates a random, cryptographically secure 16-character Recovery Key
 * formatted as: ZNC-XXXX-XXXX-XXXX (15 random alphanumeric characters + dashes).
 */
export const generateRecoveryKey = () => {
    const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789"; // Omit ambiguous chars like I, O, 1, 0
    const randomBytes = new Uint8Array(12);
    window.crypto.getRandomValues(randomBytes);
    
    let key = "ZNC";
    for (let i = 0; i < 3; i++) {
        let chunk = "";
        for (let j = 0; j < 4; j++) {
            chunk += chars[randomBytes[i * 4 + j] % chars.length];
        }
        key += `-${chunk}`;
    }
    return key;
};

/**
 * Generates E2EE RSA-OAEP 2048-bit key pair.
 * Encrypts private key under (1) derived password key and (2) derived recovery key.
 * 
 * Returns all components needed for registration.
 */
export const generateUserKeys = async (password, recoveryKey) => {
    // 1. Generate RSA-OAEP 2048-bit Key Pair
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
        },
        true, // exportable
        ["encrypt", "decrypt"]
    );

    // 2. Export keys to JWK JSON structure
    const publicKeyJWK = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKeyJWK = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const privateKeyStr = JSON.stringify(privateKeyJWK);

    // 3. Setup Salt and IVs for encryption
    const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
    const ivBytes = window.crypto.getRandomValues(new Uint8Array(12));

    const cryptoSalt = bytesToHex(saltBytes);
    const cryptoIv = bytesToHex(ivBytes);

    const enc = new TextEncoder();

    // 4. Derive keys and encrypt private key under password
    const passwordAesKey = await deriveKey(password, saltBytes);
    const passwordEncryptedBuf = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: ivBytes },
        passwordAesKey,
        enc.encode(privateKeyStr)
    );
    const encryptedPrivateKey = arrayBufferToBase64(passwordEncryptedBuf);

    // 5. Derive keys and encrypt private key under recovery key
    const recoveryAesKey = await deriveKey(recoveryKey, saltBytes);
    const recoveryEncryptedBuf = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: ivBytes },
        recoveryAesKey,
        enc.encode(privateKeyStr)
    );
    const encryptedPrivateKeyBackup = arrayBufferToBase64(recoveryEncryptedBuf);

    return {
        publicKey: publicKeyJWK,
        encryptedPrivateKey,
        encryptedPrivateKeyBackup,
        cryptoSalt,
        cryptoIv,
        rawPrivateKey: keyPair.privateKey,
        rawPublicKey: keyPair.publicKey
    };
};

/**
 * Decrypts and imports private key using the password.
 */
export const decryptPrivateKeyWithPassword = async (encryptedBundle, password, cryptoSalt, cryptoIv) => {
    const saltBytes = hexToBytes(cryptoSalt);
    const ivBytes = hexToBytes(cryptoIv);
    const encryptedData = base64ToArrayBuffer(encryptedBundle);

    const aesKey = await deriveKey(password, saltBytes);
    const decryptedBytes = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBytes },
        aesKey,
        encryptedData
    );

    const dec = new TextDecoder();
    const jwk = JSON.parse(dec.decode(decryptedBytes));

    // Import JWK back into standard CryptoKey format
    return await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["decrypt"]
    );
};

/**
 * Decrypts and imports private key using the 16-character Recovery Key.
 */
export const decryptPrivateKeyWithRecoveryKey = async (backupBundle, recoveryKey, cryptoSalt, cryptoIv) => {
    const saltBytes = hexToBytes(cryptoSalt);
    const ivBytes = hexToBytes(cryptoIv);
    const encryptedData = base64ToArrayBuffer(backupBundle);

    const aesKey = await deriveKey(recoveryKey.trim(), saltBytes);
    const decryptedBytes = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBytes },
        aesKey,
        encryptedData
    );

    const dec = new TextDecoder();
    const jwk = JSON.parse(dec.decode(decryptedBytes));

    // Import JWK back into standard CryptoKey format
    return await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["decrypt"]
    );
};

/**
 * Hybrid Encryption: Encrypts plain message content using recipient's public key.
 * 
 * Steps:
 * 1. Generates ephemeral symmetric AES-GCM key.
 * 2. Encrypts message content with AES key.
 * 3. Encrypts ephemeral AES key with recipient's RSA-OAEP public key.
 */
export const encryptMessageContent = async (plaintext, recipientPublicKeyJWK) => {
    const enc = new TextEncoder();

    // 1. Import recipient public key from JWK object
    const recipientPublicKey = await window.crypto.subtle.importKey(
        "jwk",
        recipientPublicKeyJWK,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["encrypt"]
    );

    // 2. Generate random ephemeral symmetric key (AES-GCM 256-bit)
    const ephemeralKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true, // exportable
        ["encrypt", "decrypt"]
    );

    // 3. Encrypt message text using ephemeral key
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedTextBuf = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        ephemeralKey,
        enc.encode(plaintext)
    );

    // 4. Export ephemeral key to encrypt it via RSA
    const ephemeralKeyRaw = await window.crypto.subtle.exportKey("raw", ephemeralKey);

    // 5. Encrypt the raw AES key with recipient's public key
    const encryptedAesKeyBuf = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        recipientPublicKey,
        ephemeralKeyRaw
    );

    return {
        ciphertext: arrayBufferToBase64(encryptedTextBuf),
        encryptedAesKey: arrayBufferToBase64(encryptedAesKeyBuf),
        iv: bytesToHex(iv)
    };
};

/**
 * Hybrid Decryption: Decrypts message content using recipient's private key.
 */
export const decryptMessageContent = async (ciphertext, encryptedAesKey, ivHex, rawPrivateKey) => {
    const dec = new TextDecoder();
    const iv = hexToBytes(ivHex);
    const encryptedAesKeyBuf = base64ToArrayBuffer(encryptedAesKey);
    const ciphertextBuf = base64ToArrayBuffer(ciphertext);

    // 1. Decrypt the ephemeral AES symmetric key using recipient's Private Key
    const ephemeralKeyRaw = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        rawPrivateKey,
        encryptedAesKeyBuf
    );

    // 2. Import the decrypted AES key back into CryptoKey format
    const ephemeralKey = await window.crypto.subtle.importKey(
        "raw",
        ephemeralKeyRaw,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    // 3. Decrypt the actual message ciphertext using the imported AES key
    const decryptedBuf = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        ephemeralKey,
        ciphertextBuf
    );

    return dec.decode(decryptedBuf);
};
