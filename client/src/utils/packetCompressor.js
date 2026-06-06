export const compressPacket = (msg) => {
    if (!msg) return msg;
    const compressed = {};
    if (msg.chatId !== undefined) compressed.c = msg.chatId;
    if (msg.content !== undefined) compressed.t = msg.content;
    if (msg.type !== undefined) compressed.y = msg.type;
    if (msg.mediaUrl !== undefined) compressed.u = msg.mediaUrl;
    if (msg.replyTo !== undefined) compressed.r = msg.replyTo;
    if (msg.replyToMoment) {
        compressed.o = typeof msg.replyToMoment === 'object' ? {
            _id: msg.replyToMoment._id || msg.replyToMoment,
            userId: msg.replyToMoment.userId,
            type: msg.replyToMoment.type,
            content: msg.replyToMoment.content,
            mediaUrl: msg.replyToMoment.mediaUrl,
            music: msg.replyToMoment.music,
            caption: msg.replyToMoment.caption,
            locationTag: msg.replyToMoment.locationTag,
            filter: msg.replyToMoment.filter,
        } : msg.replyToMoment;
    }
    if (msg.replyToMomentUsername !== undefined) compressed.n = msg.replyToMomentUsername;
    if (msg.isViewOnce !== undefined) compressed.v = msg.isViewOnce;
    if (msg.cid !== undefined) compressed.i = msg.cid;
    if (msg.isEncrypted !== undefined) compressed.e = msg.isEncrypted;
    if (msg.encryptedSymmetricKey !== undefined) compressed.k = msg.encryptedSymmetricKey;
    if (msg.iv !== undefined) compressed.j = msg.iv;
    if (msg.isLowBandwidth !== undefined) compressed.l = msg.isLowBandwidth;
    if (msg.status !== undefined) compressed.p = msg.status;
    if (msg.isZenMessage !== undefined) compressed.z = msg.isZenMessage;

    if (msg.senderId) {
        compressed.s = typeof msg.senderId === 'object' ? {
            _id: msg.senderId._id || msg.senderId,
            username: msg.senderId.username,
            avatar: msg.senderId.avatar
        } : msg.senderId;
    }
    if (msg.createdAt) compressed.d = msg.createdAt;
    if (msg._id) compressed.x = msg._id;
    compressed.m = true;
    return compressed;
};

export const decompressPacket = (msg) => {
    if (!msg) return msg;
    if (msg.m || msg.c !== undefined || msg.t !== undefined) {
        return {
            _id: msg.x,
            chatId: msg.c,
            content: msg.t,
            type: msg.y || "text",
            mediaUrl: msg.u,
            replyTo: msg.r,
            replyToMoment: msg.o,
            replyToMomentUsername: msg.n,
            isViewOnce: msg.v,
            cid: msg.i,
            isEncrypted: msg.e,
            encryptedSymmetricKey: msg.k,
            iv: msg.j || msg.iv,
            isLowBandwidth: msg.l,
            status: msg.p,
            senderId: msg.s,
            createdAt: msg.d,
            isZenMessage: msg.z || false,
            isCrisisMode: true
        };
    }
    return msg;
};
