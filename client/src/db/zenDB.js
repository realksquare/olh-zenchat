import Dexie from "dexie";

export const db = new Dexie("ZenChatDB");

db.version(1).stores({
    chats: "_id, updatedAt, lastMessage._id",
    messages: "_id, chatId, createdAt, senderId",
    settings: "key", 
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
};
