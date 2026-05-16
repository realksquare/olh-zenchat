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
        if (token) {
            useChatStore.getState().setActiveChat(null);
        }
    }, [token]);

    useEffect(() => {
        const hasChat = !!activeChat?._id;
        setShowChat(hasChat);
        if (hasChat) {
            window.history.pushState({ chat: true }, "");
        }
    }, [activeChat?._id]);

    useEffect(() => {
        const handlePopState = (e) => {
            if (showChat) {
                handleBackToSidebar();
            }
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [showChat]);

    const handleBackToSidebar = () => {
        useChatStore.getState().setActiveChat(null);
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