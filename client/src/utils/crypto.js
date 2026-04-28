import { db } from "../db/zenDB";
import axiosInstance from "./axios";

const KEY_STORE_ID = "e2e_keypair";
const sharedKeyCache = new Map();

let myPrivateKey = null;
let myPublicKeyJwk = null;

const subtle = window.crypto.subtle;

export const isEncrypted = (content) => {
    if (typeof content !== "string") return false;
    return content.startsWith('{"v":1,');
};

const exportPublicJwk = (key) => subtle.exportKey("jwk", key);
const exportPrivateJwk = (key) => subtle.exportKey("jwk", key);
const importPublicJwk = (jwk) =>
    subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
const importPrivateJwk = (jwk) =>
    subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);

const deriveAesKey = (privateKey, publicKey) =>
    subtle.deriveKey(
        { name: "ECDH", public: publicKey },
        privateKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );

export const initE2E = async () => {
    try {
        const stored = await db.keys.get(KEY_STORE_ID);
        if (stored) {
            myPrivateKey = await importPrivateJwk(stored.privateJwk);
            myPublicKeyJwk = stored.publicJwk;
            return;
        }
        const keyPair = await subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" },
            true,
            ["deriveKey", "deriveBits"]
        );
        const publicJwk = await exportPublicJwk(keyPair.publicKey);
        const privateJwk = await exportPrivateJwk(keyPair.privateKey);
        await db.keys.put({ id: KEY_STORE_ID, publicJwk, privateJwk });
        myPrivateKey = keyPair.privateKey;
        myPublicKeyJwk = publicJwk;
    } catch (err) {
        console.error("[E2E] initE2E failed:", err);
    }
};

export const getMyPublicKeyJwk = () => myPublicKeyJwk;

export const getSharedKey = async (peerId) => {
    if (!myPrivateKey) return null;
    if (sharedKeyCache.has(peerId)) return sharedKeyCache.get(peerId);
    try {
        const { data } = await axiosInstance.get(`/auth/public-key/${peerId}`);
        if (!data.publicKey) return null;
        const peerPublicKey = await importPublicJwk(data.publicKey);
        const aesKey = await deriveAesKey(myPrivateKey, peerPublicKey);
        sharedKeyCache.set(peerId, aesKey);
        return aesKey;
    } catch (err) {
        console.error("[E2E] getSharedKey failed for", peerId, err);
        return null;
    }
};

export const encryptMessage = async (plaintext, aesKey) => {
    try {
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(plaintext);
        const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv }, aesKey, encoded);
        return JSON.stringify({
            v: 1,
            iv: btoa(String.fromCharCode(...iv)),
            ct: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
        });
    } catch (err) {
        console.error("[E2E] encrypt failed:", err);
        return plaintext;
    }
};

export const decryptMessage = async (encryptedJson, aesKey) => {
    try {
        const { iv: ivB64, ct: ctB64 } = JSON.parse(encryptedJson);
        const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
        const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
        const decrypted = await subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ct);
        return new TextDecoder().decode(decrypted);
    } catch {
        return null;
    }
};
