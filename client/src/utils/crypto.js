/**
 * ZenChat Cryptographic Helper Module
 * Built using the high-performance native browser Web Crypto API.
 * Provides Zero-Knowledge RSA key pair generation, PBKDF2 AES-GCM private key encryption,
 * and standard-compliant RSA-OAEP + AES-GCM Hybrid Message Encryption hooks.
 */

// Helper to convert Uint8Array bytes to a Hex string
const bytesToHex = (bytes) => {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};

// Helper to convert a Hex string to a Uint8Array
const hexToBytes = (hex) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
};

// Derives an AES-256-GCM CryptoKey from a password or recovery key using PBKDF2
const deriveKey = async (passphrase, saltBytes) => {
    const encoder = new TextEncoder();
    const baseKey = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(passphrase),
        "PBKDF2",
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

// Encrypts a plaintext byte array using AES-GCM, returning prepended IV + Ciphertext hex
const encryptAES = async (plaintextBytes, key) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        plaintextBytes
    );
    // Prepend the 12-byte IV to the front of the ciphertext to avoid separate storage
    const payload = new Uint8Array(iv.length + encrypted.byteLength);
    payload.set(iv, 0);
    payload.set(new Uint8Array(encrypted), iv.length);
    return bytesToHex(payload);
};

// Decrypts a prepended IV + Ciphertext hex using AES-GCM
const decryptAES = async (encryptedHex, key) => {
    const payload = hexToBytes(encryptedHex);
    const iv = payload.slice(0, 12);
    const ciphertext = payload.slice(12);
    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        ciphertext
    );
    return new Uint8Array(decrypted);
};

/**
 * Generates secure RSA-OAEP 2048-bit keys.
 * Derives separate AES-256 keys from (1) the password (via PBKDF2) and (2) the Recovery Key.
 * Encrypts the Private Key under both, returning the public key, password-encrypted bundle, 
 * and recovery-encrypted backup bundle.
 */
export const generateUserKeys = async (password, recoveryKey) => {
    // 1. Generate RSA key pair
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
        },
        true,
        ["encrypt", "decrypt"]
    );

    // 2. Export public key as JWK (plain JSON object to store in Mixed field)
    const publicKeyJWK = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);

    // 3. Export private key as JWK, then stringify
    const privateKeyJWK = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const encoder = new TextEncoder();
    const privateKeyBytes = encoder.encode(JSON.stringify(privateKeyJWK));

    // 4. Generate dynamic salt for PBKDF2
    const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
    const cryptoSalt = bytesToHex(saltBytes);

    // 5. Derive keys from password and recovery key
    const passwordKey = await deriveKey(password, saltBytes);
    const recoveryKeyDerived = await deriveKey(recoveryKey, saltBytes);

    // 6. Encrypt private key bytes under both
    const encryptedPrivateKey = await encryptAES(privateKeyBytes, passwordKey);
    const encryptedPrivateKeyBackup = await encryptAES(privateKeyBytes, recoveryKeyDerived);

    return {
        publicKey: publicKeyJWK,
        encryptedPrivateKey,
        encryptedPrivateKeyBackup,
        cryptoSalt
    };
};

/**
 * Decrypts and imports the RSA private key using the password and salt.
 * Returns a cryptographically active private CryptoKey.
 */
export const decryptPrivateKeyWithPassword = async (encryptedPrivateKey, password, cryptoSalt) => {
    const saltBytes = hexToBytes(cryptoSalt);
    const passwordKey = await deriveKey(password, saltBytes);
    const privateKeyBytes = await decryptAES(encryptedPrivateKey, passwordKey);
    const decoder = new TextDecoder();
    const privateKeyJWK = JSON.parse(decoder.decode(privateKeyBytes));
    
    // Import back as an active CryptoKey
    return await window.crypto.subtle.importKey(
        "jwk",
        privateKeyJWK,
        {
            name: "RSA-OAEP",
            hash: "SHA-256"
        },
        false,
        ["decrypt"]
    );
};

/**
 * Decrypts and imports the RSA private key using the 16-character Recovery Key and salt.
 * Returns a cryptographically active private CryptoKey.
 */
export const decryptPrivateKeyWithRecoveryKey = async (encryptedPrivateKeyBackup, recoveryKey, cryptoSalt) => {
    const saltBytes = hexToBytes(cryptoSalt);
    const recoveryKeyDerived = await deriveKey(recoveryKey, saltBytes);
    const privateKeyBytes = await decryptAES(encryptedPrivateKeyBackup, recoveryKeyDerived);
    const decoder = new TextDecoder();
    const privateKeyJWK = JSON.parse(decoder.decode(privateKeyBytes));

    // Import back as an active CryptoKey
    return await window.crypto.subtle.importKey(
        "jwk",
        privateKeyJWK,
        {
            name: "RSA-OAEP",
            hash: "SHA-256"
        },
        false,
        ["decrypt"]
    );
};

/**
 * Performs Hybrid Message Encryption (RSA-OAEP + AES-GCM 256):
 * 1. Generates an ephemeral AES-GCM 256-bit key.
 * 2. Encrypts the plaintext using the ephemeral key.
 * 3. Encrypts the raw ephemeral key using the recipient's RSA-OAEP public key.
 * Returns hex-encoded ciphertext, encryptedSymmetricKey, and iv.
 */
export const encryptMessageContent = async (plaintext, recipientPublicKeyJWK) => {
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);

    // 1. Import recipient public key
    const recipientPublicKey = await window.crypto.subtle.importKey(
        "jwk",
        recipientPublicKeyJWK,
        {
            name: "RSA-OAEP",
            hash: "SHA-256"
        },
        false,
        ["encrypt"]
    );

    // 2. Generate ephemeral symmetric AES-GCM key
    const ephemeralKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    // 3. Encrypt the plaintext using the symmetric key
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedContent = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        ephemeralKey,
        plaintextBytes
    );

    // 4. Export the ephemeral key raw bytes, then encrypt it with recipient's RSA public key
    const rawEphemeralKey = await window.crypto.subtle.exportKey("raw", ephemeralKey);
    const encryptedSymmetricKey = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        recipientPublicKey,
        rawEphemeralKey
    );

    return {
        ciphertext: bytesToHex(new Uint8Array(encryptedContent)),
        encryptedSymmetricKey: bytesToHex(new Uint8Array(encryptedSymmetricKey)),
        iv: bytesToHex(iv)
    };
};

/**
 * Performs Hybrid Message Decryption (RSA-OAEP + AES-GCM 256):
 * 1. Decrypts the raw ephemeral AES key using the user's RSA private key.
 * 2. Imports the symmetric key.
 * 3. Decrypts the ciphertext using the symmetric key and iv.
 * Returns the decrypted plaintext string.
 */
export const decryptMessageContent = async (ciphertextHex, encryptedSymmetricKeyHex, ivHex, privateKey) => {
    // 1. Decrypt the symmetric key using the user's RSA private key
    const encryptedSymmetricKeyBytes = hexToBytes(encryptedSymmetricKeyHex);
    const rawSymmetricKey = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        encryptedSymmetricKeyBytes
    );

    // 2. Import the symmetric key back
    const symmetricKey = await window.crypto.subtle.importKey(
        "raw",
        rawSymmetricKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    // 3. Decrypt the ciphertext
    const ciphertextBytes = hexToBytes(ciphertextHex);
    const ivBytes = hexToBytes(ivHex);
    const decryptedBytes = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBytes },
        symmetricKey,
        ciphertextBytes
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBytes);
};

/**
 * Imports a public key JWK as a cryptographically active public CryptoKey.
 */
export const importPublicKey = async (publicKeyJWK) => {
    return await window.crypto.subtle.importKey(
        "jwk",
        publicKeyJWK,
        {
            name: "RSA-OAEP",
            hash: "SHA-256"
        },
        false,
        ["encrypt"]
    );
};

/**
 * Encrypts an active private CryptoKey using a 16-character Recovery Key and the existing salt.
 * Returns the hex-encrypted backup bundle.
 */
export const encryptPrivateKeyWithRecoveryKey = async (privateKey, recoveryKey, cryptoSalt) => {
    const privateKeyJWK = await window.crypto.subtle.exportKey("jwk", privateKey);
    const encoder = new TextEncoder();
    const privateKeyBytes = encoder.encode(JSON.stringify(privateKeyJWK));

    const saltBytes = hexToBytes(cryptoSalt);
    const recoveryKeyDerived = await deriveKey(recoveryKey, saltBytes);

    return await encryptAES(privateKeyBytes, recoveryKeyDerived);
};
