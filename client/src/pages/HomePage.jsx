import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useChatStore } from "../stores/chatStore";
import { useSocket } from "../context/SocketContext";
import Sidebar from "../components/chat/Sidebar";
import ChatWindow from "../components/chat/ChatWindow";
import GuestOverlay from "../components/chat/GuestOverlay";

const HomePage = () => {
    const token = useAuthStore((s) => s.token);
    const activeChat = useChatStore((s) => s.activeChat);
    const { joinChat, leaveChat, setShowExitConfirm, hasInitiatedBackRef } = useSocket();
    const isZenMode = useChatStore((s) => s.isZenMode);
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
                if (isZenMode) {
                    window.history.pushState({ chat: true }, "");
                    if (hasInitiatedBackRef) {
                        hasInitiatedBackRef.current = true;
                    }
                    if (setShowExitConfirm) {
                        setShowExitConfirm(true);
                    }
                } else {
                    handleBackToSidebar();
                }
            }
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [showChat, isZenMode, setShowExitConfirm, hasInitiatedBackRef]);

    const handleBackToSidebar = () => {
        useChatStore.getState().setActiveChat(null);
        setShowChat(false);
    };

    return (
        <div className={`home-layout ${isZenMode ? "zen-mode-layout" : ""}`}>
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