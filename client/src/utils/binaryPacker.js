/**
 * ZenChat Binary Format (ZCBF) Serialization Packer
 * Provides blazingly fast, zero-dependency binary packing and unpacking.
 * Designed to eliminate JSON parsing and Hex/Base64 text-encoding overhead.
 */

const MAGIC = new Uint8Array([0x5A, 0x43, 0x42, 0x46]); // "ZCBF"

// Helper to convert Uint8Array bytes to a Hex string
export const bytesToHex = (bytes) => {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};

// Helper to convert a Hex string to a Uint8Array
export const hexToBytes = (hex) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
};

/**
 * Checks if a buffer is a ZCBF binary packet.
 */
export const isBinaryPacket = (buffer) => {
    if (!buffer) return false;
    const isBufferOrView = buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer);
    if (!isBufferOrView) return false;

    const byteLen = buffer.byteLength;
    if (byteLen < 4) return false;

    const view = new Uint8Array(buffer.buffer || buffer, buffer.byteOffset || 0, byteLen);
    return view[0] === MAGIC[0] && view[1] === MAGIC[1] && view[2] === MAGIC[2] && view[3] === MAGIC[3];
};

/**
 * Packs a key-mapped JSON object containing primitive values or raw byte arrays into an ArrayBuffer.
 */
export const packMessage = (obj) => {
    if (!obj) return obj;

    const encoder = new TextEncoder();
    const chunks = [];
    let totalLen = MAGIC.length;

    chunks.push(MAGIC);

    for (const [key, val] of Object.entries(obj)) {
        if (val === undefined || val === null) continue;

        const keyBytes = encoder.encode(key);
        if (keyBytes.length !== 1) continue; // Keys must be 1-character mapped ASCII codes

        let type = 0;
        let data = null;

        if (typeof val === "boolean") {
            type = val ? 1 : 2;
            data = new Uint8Array(0);
        } else if (typeof val === "number") {
            type = 3;
            data = new Uint8Array(8);
            new DataView(data.buffer).setFloat64(0, val, true);
        } else if (typeof val === "string") {
            type = 4;
            const strBytes = encoder.encode(val);
            data = new Uint8Array(2 + strBytes.length);
            new DataView(data.buffer).setUint16(0, strBytes.length, true);
            data.set(strBytes, 2);
        } else if (val instanceof Uint8Array || val instanceof ArrayBuffer || ArrayBuffer.isView(val)) {
            type = 5;
            const rawBytes = val.buffer ? new Uint8Array(val.buffer, val.byteOffset, val.byteLength) : new Uint8Array(val);
            data = new Uint8Array(4 + rawBytes.length);
            new DataView(data.buffer).setUint32(0, rawBytes.length, true);
            data.set(rawBytes, 4);
        } else if (typeof val === "object") {
            // Fallback for nested objects (like senderId object) - stringify to JSON string
            type = 4;
            const strBytes = encoder.encode(JSON.stringify(val));
            data = new Uint8Array(2 + strBytes.length);
            new DataView(data.buffer).setUint16(0, strBytes.length, true);
            data.set(strBytes, 2);
        }

        if (type > 0) {
            const fieldHeader = new Uint8Array([keyBytes[0], type]);
            chunks.push(fieldHeader);
            chunks.push(data);
            totalLen += fieldHeader.length + data.length;
        }
    }

    const packed = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
        packed.set(chunk, offset);
        offset += chunk.length;
    }

    return packed.buffer;
};

/**
 * Unpacks an ArrayBuffer ZCBF packet back into a key-mapped Javascript object.
 * Auto-converts raw cryptographic bytes to Hex strings to maintain backward compatibility.
 */
export const unpackMessage = (buffer) => {
    if (!buffer) return buffer;
    if (!isBinaryPacket(buffer)) return buffer;

    const decoder = new TextDecoder();
    const byteLen = buffer.byteLength !== undefined ? buffer.byteLength : buffer.length;
    const view = new Uint8Array(buffer.buffer || buffer, buffer.byteOffset || 0, byteLen);
    const obj = {};
    let offset = 4;

    while (offset < view.length) {
        const key = String.fromCharCode(view[offset++]);
        const type = view[offset++];

        if (type === 1) {
            obj[key] = true;
        } else if (type === 2) {
            obj[key] = false;
        } else if (type === 3) {
            const doubleVal = new DataView(view.buffer, view.byteOffset + offset, 8).getFloat64(0, true);
            obj[key] = doubleVal;
            offset += 8;
        } else if (type === 4) {
            const len = new DataView(view.buffer, view.byteOffset + offset, 2).getUint16(0, true);
            offset += 2;
            const strBytes = view.slice(offset, offset + len);
            obj[key] = decoder.decode(strBytes);
            offset += len;

            // Auto-de-serialize JSON objects if they start with standard JSON markers (excluding key 'k' to prevent CastError)
            if (key !== "k" && key !== "encryptedSymmetricKey" && obj[key].startsWith("{") && obj[key].endsWith("}")) {
                try {
                    obj[key] = JSON.parse(obj[key]);
                } catch (_) {}
            }
        } else if (type === 5) {
            const len = new DataView(view.buffer, view.byteOffset + offset, 4).getUint32(0, true);
            offset += 4;
            const rawBytes = view.slice(offset, offset + len);
            offset += len;

            // Backward-compatible Hex conversions for cryptographic properties:
            // 't' = ciphertext, 'j' or 'iv' = IV, 'k' = encryptedSymmetricKeyRec/Snd
            if (key === "t" || key === "j" || key === "iv" || key === "k" || key === "encryptedSymmetricKeyRec" || key === "encryptedSymmetricKeySnd") {
                obj[key] = bytesToHex(rawBytes);
            } else {
                obj[key] = rawBytes;
            }
        }
    }

    return obj;
};
