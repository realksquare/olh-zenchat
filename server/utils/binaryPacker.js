/**
 * ZenChat Binary Format (ZCBF) Server Serialization Packer
 * Provides Node.js compatible binary packing and unpacking counterpart.
 * Ensures E2EE binary payloads convert cleanly back to Hex strings for MongoDB persistence.
 */

const MAGIC = Buffer.from([0x5A, 0x43, 0x42, 0x46]); // "ZCBF"

// Helper to convert Buffer bytes to a Hex string
const bytesToHex = (bytes) => {
    return bytes.toString("hex");
};

// Helper to convert a Hex string to a Buffer
const hexToBytes = (hex) => {
    return Buffer.from(hex, "hex");
};

/**
 * Checks if a buffer is a ZCBF binary packet.
 */
const isBinaryPacket = (buffer) => {
    if (!buffer) return false;
    const isBufOrView = Buffer.isBuffer(buffer) || buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer);
    if (!isBufOrView) return false;

    const byteLen = Buffer.isBuffer(buffer) ? buffer.length : buffer.byteLength;
    if (byteLen < 4) return false;

    const buf = Buffer.isBuffer(buffer)
        ? buffer
        : Buffer.from(buffer.buffer || buffer, buffer.byteOffset || 0, byteLen);

    return buf[0] === MAGIC[0] && buf[1] === MAGIC[1] && buf[2] === MAGIC[2] && buf[3] === MAGIC[3];
};

/**
 * Packs a key-mapped JSON object containing primitive values or raw byte arrays into an ArrayBuffer/Buffer.
 */
const packMessage = (obj) => {
    if (!obj) return obj;

    const chunks = [];
    let totalLen = MAGIC.length;

    chunks.push(MAGIC);

    for (const [key, val] of Object.entries(obj)) {
        if (val === undefined || val === null) continue;

        const keyBytes = Buffer.from(key, "ascii");
        if (keyBytes.length !== 1) continue; // Keys must be 1-character mapped ASCII codes

        let type = 0;
        let data = null;

        if (typeof val === "boolean") {
            type = val ? 1 : 2;
            data = Buffer.alloc(0);
        } else if (typeof val === "number") {
            type = 3;
            data = Buffer.alloc(8);
            data.writeDoubleLE(val, 0);
        } else if (typeof val === "string") {
            type = 4;
            const strBytes = Buffer.from(val, "utf8");
            data = Buffer.alloc(2 + strBytes.length);
            data.writeUInt16LE(strBytes.length, 0);
            strBytes.copy(data, 2);
        } else if (Buffer.isBuffer(val) || val instanceof Uint8Array || val instanceof ArrayBuffer || ArrayBuffer.isView(val)) {
            type = 5;
            const rawBytes = Buffer.isBuffer(val) ? val : Buffer.from(val.buffer || val);
            data = Buffer.alloc(4 + rawBytes.length);
            data.writeUInt32LE(rawBytes.length, 0);
            rawBytes.copy(data, 4);
        } else if (typeof val === "object") {
            // Fallback for nested objects (like senderId object) - stringify to JSON string
            type = 4;
            const strBytes = Buffer.from(JSON.stringify(val), "utf8");
            data = Buffer.alloc(2 + strBytes.length);
            data.writeUInt16LE(strBytes.length, 0);
            strBytes.copy(data, 2);
        }

        if (type > 0) {
            const fieldHeader = Buffer.from([keyBytes[0], type]);
            chunks.push(fieldHeader);
            chunks.push(data);
            totalLen += fieldHeader.length + data.length;
        }
    }

    return Buffer.concat(chunks, totalLen);
};

/**
 * Unpacks a Buffer ZCBF packet back into a key-mapped Javascript object.
 * Auto-converts raw cryptographic bytes to Hex strings to maintain backward compatibility.
 */
const unpackMessage = (buffer) => {
    if (!buffer) return buffer;
    if (!isBinaryPacket(buffer)) return buffer;

    const byteLen = Buffer.isBuffer(buffer) ? buffer.length : buffer.byteLength;
    const view = Buffer.isBuffer(buffer)
        ? buffer
        : Buffer.from(buffer.buffer || buffer, buffer.byteOffset || 0, byteLen);
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
            const doubleVal = view.readDoubleLE(offset);
            obj[key] = doubleVal;
            offset += 8;
        } else if (type === 4) {
            const len = view.readUInt16LE(offset);
            offset += 2;
            const strBytes = view.subarray(offset, offset + len);
            obj[key] = strBytes.toString("utf8");
            offset += len;

            // Auto-de-serialize JSON objects if they start with standard JSON markers (excluding key 'k' to prevent CastError)
            if (key !== "k" && key !== "encryptedSymmetricKey" && obj[key].startsWith("{") && obj[key].endsWith("}")) {
                try {
                    obj[key] = JSON.parse(obj[key]);
                } catch (_) {}
            }
        } else if (type === 5) {
            const len = view.readUInt32LE(offset);
            offset += 4;
            const rawBytes = view.subarray(offset, offset + len);
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

module.exports = { packMessage, unpackMessage, isBinaryPacket, bytesToHex, hexToBytes };
