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
    keys: "id",
});

export const persistChat = async (chat) => {
    try {
        await db.chats.put(chat);
    } catch (err) {
        console.error(err);
    }
};

export const persistMessage = async (message) => {
    try {
        await db.messages.put(message);
    } catch (err) {
        console.error(err);
    }
};

export const getLocalChats = async () => {
    return await db.chats.reverse().sortBy("updatedAt");
};

export const getLocalMessages = async (chatId) => {
    return await db.messages.where("chatId").equals(chatId).sortBy("createdAt");
};

export const clearLocalData = async () => {
    await db.chats.clear();
    await db.messages.clear();
    if (db.settings) await db.settings.clear();
    if (db.outbox) await db.outbox.clear();
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
