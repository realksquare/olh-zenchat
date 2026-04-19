import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useChatStore } from "../stores/chatStore";
import { useSocket } from "../context/SocketContext";
import Sidebar from "../components/chat/Sidebar";
import ChatWindow from "../components/chat/ChatWindow";
import GuestOverlay from "../components/chat/GuestOverlay";

const HomePage = () => {
    const { user, token } = useAuthStore();
    const { activeChat, fetchChats } = useChatStore();
    const { joinChat, leaveChat } = useSocket();
    const [showChat, setShowChat] = useState(false);

    useEffect(() => {
        if (token) fetchChats();
    }, [token]);

    useEffect(() => {
        if (!activeChat) return;
        joinChat(activeChat._id);
        setShowChat(true);
        return () => leaveChat(activeChat._id);
    }, [activeChat]);

    const handleBackToSidebar = () => {
        setShowChat(false);
    };

    return (
        <div className="home-layout">
            {!token && <GuestOverlay />}

            <div className={`sidebar-panel ${showChat ? "sidebar-hidden" : ""}`}>
                <Sidebar onChatSelect={() => setShowChat(true)} />
            </div>

            <div className={`chat-panel ${showChat ? "chat-visible" : ""}`}>
                <ChatWindow onBack={handleBackToSidebar} />
            </div>
        </div>
    );
};

export default HomePage;