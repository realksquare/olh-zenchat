export const compressPacket = (msg) => {
    if (!msg) return msg;
    const compressed = {};
    if (msg.chatId !== undefined) compressed.c = msg.chatId;
    if (msg.content !== undefined) compressed.t = msg.content;
    if (msg.type !== undefined) compressed.y = msg.type;
    if (msg.mediaUrl !== undefined) compressed.u = msg.mediaUrl;
    if (msg.replyTo !== undefined) compressed.r = msg.replyTo;
    if (msg.isViewOnce !== undefined) compressed.v = msg.isViewOnce;
    if (msg.cid !== undefined) compressed.i = msg.cid;
    if (msg.isEncrypted !== undefined) compressed.e = msg.isEncrypted;
    if (msg.encryptedSymmetricKey !== undefined) compressed.k = msg.encryptedSymmetricKey;
    if (msg.iv !== undefined) compressed.j = msg.iv;
    if (msg.isLowBandwidth !== undefined) compressed.l = msg.isLowBandwidth;
    compressed.m = true;
    return compressed;
};

export const decompressPacket = (msg) => {
    if (!msg) return msg;
    if (msg.m || msg.c !== undefined || msg.t !== undefined) {
        return {
            chatId: msg.c,
            content: msg.t,
            type: msg.y || "text",
            mediaUrl: msg.u,
            replyTo: msg.r,
            isViewOnce: msg.v,
            cid: msg.i,
            isEncrypted: msg.e,
            encryptedSymmetricKey: msg.k,
            iv: msg.j || msg.iv,
            isLowBandwidth: msg.l,
            isCrisisMode: true
        };
    }
    return msg;
};
