import Dexie from "dexie";

export const db = new Dexie("ZenChatDB");

db.version(2).stores({
    chats: "_id, updatedAt, lastMessage._id",
    messages: "_id, chatId, createdAt, senderId",
    settings: "key",
});

db.version(3).stores({
    chats: "_id, updatedAt, lastMessage._id",
    messages: "_id, chatId, createdAt, senderId",
    settings: "key",
    outbox: "++id, chatId, createdAt",
});

db.version(4).stores({
    chats: "_id, updatedAt, lastMessage._id",
    messages: "_id, chatId, createdAt, senderId",
    settings: "key",
    outbox: "++id, chatId, createdAt",
    keys: "key", // Keys: 'privateKey', 'publicKey', 'recoveryKeySaved'
});

db.version(5).stores({
    chats: "_id, updatedAt, lastMessage._id",
    messages: "_id, chatId, createdAt, senderId",
    settings: "key",
    outbox: "++id, chatId, createdAt",
    keys: "key",
    vault: "id, name, type, size, date",
});

db.version(6).stores({
    chats: "_id, updatedAt, lastMessage._id",
    messages: "_id, chatId, createdAt, senderId",
    settings: "key",
    outbox: "++id, chatId, createdAt",
    keys: "key",
    vault: "id, name, type, size, date",
    pendingMediaOutbox: "++id, chatId, createdAt",
});

db.version(7).stores({
    chats: "_id, updatedAt, lastMessage._id",
    messages: "_id, chatId, createdAt, senderId",
    settings: "key",
    outbox: "++id, chatId, createdAt",
    keys: "key",
    vault: "id, name, type, size, date",
    pendingMediaOutbox: "++id, chatId, createdAt",
    autocomplete_model: "key, lastSeen",
});

export const healMessageDate = (message) => {
    if (!message) return message;
    if (message.createdAt) {
        const d = new Date(message.createdAt);
        if (!isNaN(d.getTime())) return message;
    }
    // Try to extract timestamp from MongoDB ObjectId (_id)
    if (message._id && typeof message._id === 'string' && message._id.length === 24) {
        try {
            const timestamp = parseInt(message._id.substring(0, 8), 16) * 1000;
            const d = new Date(timestamp);
            if (!isNaN(d.getTime())) {
                message.createdAt = d.toISOString();
                return message;
            }
        } catch (e) {
            // Ignore
        }
    }
    message.createdAt = new Date().toISOString();
    return message;
};

export const persistChat = async (chat) => {
    try {
        if (chat && chat.lastMessage) {
            chat.lastMessage = healMessageDate(chat.lastMessage);
        }
        await db.chats.put(chat);
    } catch (err) {
        console.error(err);
    }
};

export const persistMessage = async (message) => {
    try {
        const healed = healMessageDate(message);
        await db.messages.put(healed);
    } catch (err) {
        console.error(err);
    }
};

export const getLocalChats = async () => {
    const chats = await db.chats.reverse().sortBy("updatedAt");
    return chats.map(c => {
        if (c.lastMessage) {
            c.lastMessage = healMessageDate(c.lastMessage);
        }
        return c;
    });
};

export const getLocalMessages = async (chatId) => {
    const msgs = await db.messages.where("chatId").equals(chatId).sortBy("createdAt");
    return msgs.slice(-18).map(m => healMessageDate(m));
};

export const clearLocalData = async () => {
    await db.chats.clear();
    await db.messages.clear();
    if (db.settings) await db.settings.clear();
    if (db.outbox) await db.outbox.clear();
    if (db.keys) await db.keys.clear();
    if (db.vault) await db.vault.clear();
    if (db.pendingMediaOutbox) await db.pendingMediaOutbox.clear();
    if (db.autocomplete_model) await db.autocomplete_model.clear();
};

export const enqueueOutbox = async (payload) => {
    try {
        await db.outbox.add({ ...payload, createdAt: Date.now() });
    } catch (err) {
        console.error(err);
    }
};

export const drainOutbox = async () => {
    try {
        const items = await db.outbox.orderBy("createdAt").toArray();
        await db.outbox.clear();
        return items;
    } catch (err) {
        console.error(err);
        return [];
    }
};

export const enqueuePendingMedia = async (payload) => {
    try {
        await db.pendingMediaOutbox.add({ ...payload, createdAt: Date.now() });
    } catch (err) {
        console.error("[zenDB] enqueuePendingMedia failed:", err);
    }
};

export const drainPendingMedia = async () => {
    try {
        const items = await db.pendingMediaOutbox.orderBy("createdAt").toArray();
        await db.pendingMediaOutbox.clear();
        return items;
    } catch (err) {
        console.error("[zenDB] drainPendingMedia failed:", err);
        return [];
    }
};

export const getAutocompleteModel = async () => {
    try {
        if (!db.autocomplete_model) return {};
        const entries = await db.autocomplete_model.toArray();
        const model = {};
        entries.forEach(e => { model[e.key] = { count: e.count, lastSeen: e.lastSeen }; });
        return model;
    } catch (err) {
        console.error("[zenDB] getAutocompleteModel failed:", err);
        return {};
    }
};

export const upsertAutocompleteEntry = async (key, increment) => {
    try {
        if (!db.autocomplete_model) return;
        const count = await db.autocomplete_model.count();
        
        // Cap the model size to prevent unbounded growth (~2000 entries max is plenty for chat)
        if (count > 2000) {
            // Prune entries that have only been seen once
            await db.autocomplete_model.filter(entry => entry.count === 1).delete();
        }

        const existing = await db.autocomplete_model.get(key);
        if (existing) {
            await db.autocomplete_model.put({
                key,
                count: existing.count + increment,
                lastSeen: Date.now()
            });
        } else {
            await db.autocomplete_model.put({
                key,
                count: increment,
                lastSeen: Date.now()
            });
        }
    } catch (err) {
        console.error("[zenDB] upsertAutocompleteEntry failed:", err);
    }
};
