import { useState, useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";
import axiosInstance from "../../utils/axios";
import ChatCard from "./ChatCard";
import ProfileModal from "../ui/ProfileModal";

const Sidebar = ({ onChatSelect }) => {
    const { user, logout } = useAuthStore();
    const { chats, activeChat, setActiveChat, addChat, isLoadingChats } = useChatStore();
    const [search, setSearch] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [pinnedChatId, setPinnedChatId] = useState(
        localStorage.getItem("zenchat_pinned") || null
    );
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    useEffect(() => {
        const delayDebounce = setTimeout(async () => {
            if (search.trim().length < 2) {
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            try {
                const { data } = await axiosInstance.get(`/chats/users?search=${search.trim()}`);
                setSearchResults(data.users);
            } catch (_) {
                setSearchResults([]);
            }
            setIsSearching(false);
        }, 400);
        return () => clearTimeout(delayDebounce);
    }, [search]);

    const handleSelectUser = async (userId) => {
        try {
            const { data } = await axiosInstance.post("/chats", { userId });
            addChat(data.chat);
            const freshChat =
                useChatStore.getState().chats.find((c) => c._id === data.chat._id) || data.chat;
            setActiveChat(freshChat);
            setSearch("");
            setSearchResults([]);
            onChatSelect();
        } catch (_) { }
    };

    const handleSelectChat = (chat) => {
        const freshChat =
            useChatStore.getState().chats.find((c) => c._id === chat._id) || chat;
        setActiveChat(freshChat);
        onChatSelect();
    };

    const handlePin = (chatId) => {
        const newPinned = pinnedChatId === chatId ? null : chatId;
        setPinnedChatId(newPinned);
        if (newPinned) {
            localStorage.setItem("zenchat_pinned", newPinned);
        } else {
            localStorage.removeItem("zenchat_pinned");
        }
    };

    const pinnedChat = chats.find((c) => c._id === pinnedChatId);
    const unpinnedChats = chats.filter((c) => c._id !== pinnedChatId);

    const getInitials = (name) =>
        name ? name.slice(0, 2).toUpperCase() : "??";

    const getOtherParticipant = (chat) =>
        chat.participants?.find((p) => p._id !== user?._id);

    return (
        <div className="sidebar">
            <div className="sidebar-profile">
                <div 
                    className="avatar avatar-sm" 
                    onClick={() => setIsProfileOpen(true)}
                    style={{ cursor: "pointer" }}
                    title="Edit Profile"
                >
                    {user?.avatar ? (
                        <img src={user.avatar} alt={user.username} />
                    ) : (
                        <span>{getInitials(user?.username)}</span>
                    )}
                </div>
                <span className="sidebar-username" onClick={() => setIsProfileOpen(true)} style={{ cursor: "pointer" }} title="Edit Profile">
                    {user?.username}
                </span>
                <button
                    className="sidebar-logout"
                    onClick={logout}
                    aria-label="Sign out"
                    title="Sign out"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                </button>
            </div>

            <div className="sidebar-search-wrap">
                <div className="sidebar-search">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Search users"
                    />
                    {search && (
                        <button
                            onClick={() => {
                                setSearch("");
                                setSearchResults([]);
                            }}
                            aria-label="Clear search"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>

                {search.trim().length >= 2 && (
                    <div className="search-results">
                        {isSearching && (
                            <div className="search-status">Searching...</div>
                        )}
                        {!isSearching && searchResults.length === 0 && (
                            <div className="search-status">No users found</div>
                        )}
                        {searchResults.map((u) => (
                            <button
                                key={u._id}
                                className="search-result-item"
                                onClick={() => handleSelectUser(u._id)}
                            >
                                <div className="avatar avatar-sm">
                                    {u.avatar ? (
                                        <img src={u.avatar} alt={u.username} />
                                    ) : (
                                        <span>{getInitials(u.username)}</span>
                                    )}
                                </div>
                                <div className="search-result-info">
                                    <span className="search-result-name">{u.username}</span>
                                    {u.isOnline && <span className="online-badge">Online</span>}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="sidebar-chats">
                {isLoadingChats && (
                    <div className="chats-loading">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="chat-card-skeleton">
                                <div className="skeleton skeleton-avatar" />
                                <div className="skeleton-lines">
                                    <div className="skeleton skeleton-text" style={{ width: "60%" }} />
                                    <div className="skeleton skeleton-text" style={{ width: "40%" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!isLoadingChats && chats.length === 0 && (
                    <div className="chats-empty">
                        <p>No conversations yet</p>
                        <span>Search for a user to start chatting</span>
                    </div>
                )}

                {pinnedChat && (
                    <div className="chats-section">
                        <span className="chats-section-label">Pinned</span>
                        <ChatCard
                            chat={pinnedChat}
                            isActive={activeChat?._id === pinnedChat._id}
                            isPinned
                            currentUserId={user?._id}
                            onSelect={() => handleSelectChat(pinnedChat)}
                            onPin={() => handlePin(pinnedChat._id)}
                        />
                    </div>
                )}

                {unpinnedChats.length > 0 && (
                    <div className="chats-section">
                        {pinnedChat && <span className="chats-section-label">Recent</span>}
                        {unpinnedChats.map((chat) => (
                            <ChatCard
                                key={chat._id}
                                chat={chat}
                                isActive={activeChat?._id === chat._id}
                                isPinned={false}
                                currentUserId={user?._id}
                                onSelect={() => handleSelectChat(chat)}
                                onPin={() => handlePin(chat._id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <ProfileModal 
                isOpen={isProfileOpen} 
                onClose={() => setIsProfileOpen(false)} 
            />
        </div>
    );
};

export default Sidebar;