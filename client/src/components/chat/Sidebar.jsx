import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "../../stores/chatStore";

import axiosInstance from "../../utils/axios";
import ChatCard from "./ChatCard";
import ProfileModal from "../ui/ProfileModal";
import AdminPanel from "../ui/AdminPanel";
import FAQModal from "../ui/FAQModal";
import E2EEInfoModal from "../ui/E2EEInfoModal";
import InviteModal from "../ui/InviteModal";
import MomentsRow from "./MomentsRow";
import MomentCreator from "./MomentCreator";
import MomentViewer from "./MomentViewer";
import ZenVaultModal from "../ui/ZenVaultModal";
import YourTimeDashboard from "../ui/YourTimeDashboard";
import { useMomentStore } from "../../stores/momentStore";
import { VerifiedTick, AdminIcon, HelpIcon, InviteIcon } from "../ui/Icons";

const Sidebar = ({ onChatSelect }) => {
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const { hasActiveMoment, getHaloColor } = useMomentStore.getState();
    const { 
        chats, activeChat, setActiveChat, 
        addChat, isLoadingChats, togglePinChat, onlineUsers, isOffline
    } = useChatStore(useShallow((s) => ({
        chats: s.chats,
        activeChat: s.activeChat,
        setActiveChat: s.setActiveChat,
        addChat: s.addChat,
        isLoadingChats: s.isLoadingChats,
        togglePinChat: s.togglePinChat,
        onlineUsers: s.onlineUsers,
        isOffline: s.isOffline
    })));
    const [search, setSearch] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isAdminOpen, setIsAdminOpen] = useState(false);
    const [isFAQOpen, setIsFAQOpen] = useState(false);
    const [isE2EEInfoOpen, setIsE2EEInfoOpen] = useState(false);
    const [pwaPrompt, setPwaPrompt] = useState(window.deferredPrompt || null);
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [isMomentCreatorOpen, setIsMomentCreatorOpen] = useState(false);
    const [activeViewerMoments, setActiveViewerMoments] = useState(null);
    const [activeTab, setActiveTab] = useState("recents");
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [isVaultOpen, setIsVaultOpen] = useState(false);
    const [isYourTimeOpen, setIsYourTimeOpen] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const { fetchChats } = useChatStore();
    const { fetchMoments } = useMomentStore();
    
    const [pullY, setPullY] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isKeyboardRefresh, setIsKeyboardRefresh] = useState(false);
    const pullStartY = useRef(0);
    const isPulling = useRef(false);
    const chatsRef = useRef(null);
    const PULL_THRESHOLD = 72;

    useEffect(() => {
        const handlePrompt = (e) => {
            setPwaPrompt(e.detail);
        };
        window.addEventListener("pwa-prompt-available", handlePrompt);
        return () => window.removeEventListener("pwa-prompt-available", handlePrompt);
    }, []);

    const handleTouchStart = useCallback((e) => {
        if (chatsRef.current?.scrollTop === 0) {
            pullStartY.current = e.touches[0].clientY;
            isPulling.current = true;
        }
    }, []);

    const handleTouchMove = useCallback((e) => {
        if (!isPulling.current) return;
        const delta = e.touches[0].clientY - pullStartY.current;
        if (delta > 0 && chatsRef.current?.scrollTop === 0) {
            if (e.cancelable) e.preventDefault();
            setPullY(Math.min(delta * 0.45, PULL_THRESHOLD + 20));
        } else {
            isPulling.current = false;
        }
    }, []);

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling.current) return;
        isPulling.current = false;
        if (pullY >= PULL_THRESHOLD) {
            setIsRefreshing(true);
            setPullY(PULL_THRESHOLD);
            await Promise.all([
                useChatStore.getState().fetchChats(),
                useMomentStore.getState().fetchMoments()
            ]);
            setIsRefreshing(false);
        }
        setPullY(0);
    }, [pullY]);

    useEffect(() => {
        fetchMoments();
    }, []);

    useEffect(() => {
        const handleKeyDown = async (e) => {
            const isF5 = e.key === "F5";
            const isCtrlR = (e.ctrlKey || e.metaKey) && e.key === "r";
            if (isF5 || isCtrlR) {
                e.preventDefault();
                setIsKeyboardRefresh(true);
                setIsRefreshing(true);
                setPullY(PULL_THRESHOLD);
                await Promise.all([
                    useChatStore.getState().fetchChats(),
                    useMomentStore.getState().fetchMoments(),
                    useAuthStore.getState().checkAuth()
                ]).catch(() => {});
                setTimeout(() => {
                    setIsRefreshing(false);
                    setPullY(0);
                    setIsKeyboardRefresh(false);
                }, 1000);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);


    const sidebarRef = useRef(null);
    useEffect(() => {
        const el = sidebarRef.current;
        if (!el) return;
        el.addEventListener('touchmove', handleTouchMove, { passive: false });
        return () => el.removeEventListener('touchmove', handleTouchMove);
    }, [handleTouchMove]);


    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("tab");
        if (tab === "contacts" || tab === "recents") {
            setActiveTab(tab);
        }
    }, []);

    useEffect(() => {
        if (sessionStorage.getItem("showFAQOnLoad") === "1") {
            sessionStorage.removeItem("showFAQOnLoad");
            setIsFAQOpen(true);
        }
    }, []);

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
            const freshChat = useChatStore.getState().chats.find((c) => c._id === data.chat._id) || data.chat;
            setActiveChat(freshChat);
            setSearch("");
            setSearchResults([]);
            onChatSelect();
        } catch (_) { }
    };

    const handleSelectChat = (chat) => {
        const freshChat = useChatStore.getState().chats.find((c) => c._id === chat._id) || chat;
        setActiveChat(freshChat);
        onChatSelect();
    };

    // Handle notification deep-link: open chat when user taps "Open & Reply" on a push notification
    useEffect(() => {
        const handler = (e) => {
            const { chatId } = e.detail || {};
            if (!chatId) return;
            const chat = useChatStore.getState().chats.find(c => c._id === chatId);
            if (chat) {
                setActiveChat(chat);
                onChatSelect();
            }
        };
        window.addEventListener("sw-open-chat", handler);
        return () => window.removeEventListener("sw-open-chat", handler);
    }, [onChatSelect, setActiveChat]);

    const handleInviteClick = () => {
        setIsInviteOpen(true);
    };

    const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : "??";
    const getOtherParticipant = (chat) => chat.participants?.find((p) => p._id !== user?._id);

    const filteredChats = useMemo(() => {
        const isContactChat = (chat) => {
            const other = chat.participants?.find((p) => p._id !== user?._id);
            if (!other) return false;
            return user?.contacts?.some(
                c => c.userId?.toString() === other._id?.toString() || c.userId === other._id
            );
        };
        return activeTab === "contacts" ? chats.filter(isContactChat) : chats;
    }, [chats, activeTab, user?._id, user?.contacts]);

    const filteredSearchResults = useMemo(() => {
        if (activeTab !== "contacts") return searchResults;
        return searchResults.filter(u => user?.contacts?.some(
            c => c.userId?.toString() === u._id?.toString() || c.userId === u._id
        ));
    }, [searchResults, activeTab, user?.contacts]);

    const pinnedChats = useMemo(() => filteredChats.filter((c) => c.pinnedBy?.includes(user?._id)), [filteredChats, user?._id]);
    const unpinnedChats = useMemo(() => filteredChats.filter((c) => !c.pinnedBy?.includes(user?._id)), [filteredChats, user?._id]);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    const [isPwaInstalled, setIsPwaInstalled] = useState(
        () => localStorage.getItem("zenchat_pwa_installed") === "true"
    );

    useEffect(() => {
        const handleStatusChanged = () => {
            setIsPwaInstalled(localStorage.getItem("zenchat_pwa_installed") === "true");
        };
        window.addEventListener("pwa-installed-status-changed", handleStatusChanged);
        window.addEventListener("storage", handleStatusChanged);
        return () => {
            window.removeEventListener("pwa-installed-status-changed", handleStatusChanged);
            window.removeEventListener("storage", handleStatusChanged);
        };
    }, []);

    const handlePwaButtonClick = () => {
        if (isPwaInstalled) {
            window.dispatchEvent(new CustomEvent("open-pwa-nudge-modal"));
        } else {
            window.dispatchEvent(new CustomEvent("open-pwa-install-modal"));
        }
    };

    return (
        <div 
            className="sidebar" 
            ref={sidebarRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {(pullY > 0 || isRefreshing) && (
                <div className="ptr-indicator" style={{ 
                    opacity: Math.min(pullY / PULL_THRESHOLD, 1), 
                    position: isKeyboardRefresh ? 'fixed' : 'absolute',
                    top: isKeyboardRefresh ? '24px' : '12px',
                    left: '50%',
                    transform: isKeyboardRefresh 
                        ? 'translateX(-50%) scale(1)' 
                        : `translateX(-50%) translateY(${Math.max(0, pullY - 40)}px) scale(${0.6 + 0.4 * Math.min(pullY / PULL_THRESHOLD, 1)})`,
                    zIndex: isKeyboardRefresh ? 10000 : 1000,
                    transition: isKeyboardRefresh ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease' : 'none'
                }}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="16" r="13" stroke="rgba(61,165,217,0.15)" strokeWidth="2.5"/>
                        <circle
                            cx="16" cy="16" r="13"
                            stroke="#3da5d9"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 13}`}
                            strokeDashoffset={`${2 * Math.PI * 13 * (1 - Math.min(pullY / PULL_THRESHOLD, 1))}`}
                            transform="rotate(-90 16 16)"
                            style={{ transition: isRefreshing ? 'none' : 'stroke-dashoffset 0.05s linear' }}
                            className={isRefreshing ? 'ptr-arc-spin' : ''}
                        />
                        <text x="16" y="20.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#3da5d9" fontFamily="inherit">Z</text>
                    </svg>
                </div>
            )}
            <div className="sidebar-profile">
                <div
                    className={`avatar avatar-sm ${hasActiveMoment(user?._id) ? 'moments-halo-thin' : ''}`}
                    onClick={() => setIsProfileOpen(true)}
                    style={{ 
                        cursor: "pointer",
                        ...(hasActiveMoment(user?._id) ? { '--halo-color': getHaloColor(user?._id, user?._id) } : {})
                    }}
                    title="Edit Profile"
                >
                    {user?.avatar ? (
                        <img src={user.avatar} alt={user.username} />
                    ) : (
                        <span>{getInitials(user?.username)}</span>
                    )}
                </div>
                <span className="sidebar-username" onClick={() => setIsProfileOpen(true)} style={{ cursor: "pointer" }} title="Edit Profile">
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{user?.username}</span>
                    {user?.isVerified && <VerifiedTick style={{ marginLeft: 0, flexShrink: 0 }} />}
                </span>
                <div className="sidebar-profile-actions">
                    <button 
                        className="sidebar-profile-btn logout" 
                        onClick={() => setShowLogoutConfirm(true)} 
                        aria-label="Sign out" 
                        title="Sign out"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                    <button
                        className="sidebar-profile-btn"
                        onClick={() => setShowMobileMenu(true)}
                        aria-label="Menu"
                        title="Menu"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>

            <MomentsRow 
                onAddMoment={() => setIsMomentCreatorOpen(true)} 
                onViewMoment={(moments) => setActiveViewerMoments(moments)} 
            />

            <MomentCreator 
                isOpen={isMomentCreatorOpen} 
                onClose={() => setIsMomentCreatorOpen(false)} 
            />

            <MomentViewer 
                moments={activeViewerMoments || []}
                isOpen={!!activeViewerMoments}
                onClose={() => setActiveViewerMoments(null)}
            />

            <div className="sidebar-search-wrap">
                <div className="sidebar-search">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder={activeTab === "contacts" ? "Search contacts..." : "Search users..."}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Search users"
                    />
                    {search && (
                        <button onClick={() => { setSearch(""); setSearchResults([]); }} aria-label="Clear search">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>

                <div className="sidebar-tabs">
                    <button
                        className={`sidebar-tab ${activeTab === "recents" ? "active" : ""}`}
                        onClick={() => setActiveTab("recents")}
                    >
                        Recents
                    </button>
                    <button
                        className={`sidebar-tab ${activeTab === "contacts" ? "active" : ""}`}
                        onClick={() => setActiveTab("contacts")}
                    >
                        Contacts
                        {(() => {
                            if (isOffline) return null;
                            const onlineContactsCount = user?.contacts?.filter(c => {
                                const uid = c.userId?._id?.toString() || c.userId?.toString();
                                return onlineUsers.has(uid);
                            }).length;
                            return onlineContactsCount > 0 ? (
                                <span className="sidebar-tab-badge online">{onlineContactsCount}</span>
                            ) : null;
                        })()}
                    </button>
                </div>

                {search.trim().length >= 2 && (
                    <div className="search-results">
                        {isSearching && <div className="search-status">Searching...</div>}
                        {!isSearching && filteredSearchResults.length === 0 && (
                            <div className="search-status">
                                {activeTab === "contacts" ? "No contacts match" : "No users found"}
                            </div>
                        )}
                        {filteredSearchResults.map((u) => {
                            const isUserContact = user?.contacts?.some(
                                c => c.userId?.toString() === u._id?.toString() || c.userId === u._id
                            );
                            return (
                                <button key={u._id} className="search-result-item" onClick={() => handleSelectUser(u._id)}>
                                    <div className="avatar avatar-sm">
                                        {u.avatar ? (
                                            <img src={u.avatar} alt={u.username} />
                                        ) : (
                                            <span>{getInitials(u.username)}</span>
                                        )}
                                    </div>
                                    <div className="search-result-info">
                                        <span className="search-result-name">
                                            {u.username} {isUserContact && (
                                                <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', color: '#38bdf8', borderRadius: '12px', marginLeft: '6px', fontWeight: 'bold' }}>Contact</span>
                                            )}
                                            {u.isVerified && <VerifiedTick />}
                                        </span>
                                        {!isOffline && u.isOnline && !user?.blockedUsers?.some(b => (b.userId?._id || b.userId)?.toString() === u._id?.toString()) && <span className="online-badge">Online</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <div
                className="sidebar-chats"
                ref={chatsRef}
            >
                <div
                    style={{ 
                        transform: pullY > 0 ? `translateY(${pullY}px)` : undefined, 
                        transition: pullY === 0 ? 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: '100%'
                    }}
                >
                    {isLoadingChats && filteredChats.length === 0 && (
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

                    {!isLoadingChats && filteredChats.length === 0 && (
                        <div className="chats-empty">
                            {activeTab === "contacts" ? (
                                <>
                                    <p>No contacts yet</p>
                                    <span>Tag users as contacts from the three-dot menu on any chat</span>
                                </>
                            ) : (
                                <>
                                    <p>No conversations yet</p>
                                    <span>Search for a user to start chatting</span>
                                </>
                            )}
                        </div>
                    )}

                    {pinnedChats.length > 0 && (
                        <div className="chats-section">
                            <span className="chats-section-label">Pinned</span>
                            {pinnedChats.map((chat) => (
                                <ChatCard
                                    key={chat._id}
                                    chat={chat}
                                    isActive={activeChat?._id === chat._id}
                                    isPinned={true}
                                    currentUserId={user?._id}
                                    onSelect={() => handleSelectChat(chat)}
                                    onPin={() => togglePinChat(chat._id)}
                                />
                            ))}
                        </div>
                    )}

                    {unpinnedChats.length > 0 && (
                        <div className="chats-section">
                            {pinnedChats.length > 0 && <span className="chats-section-label">Recent</span>}
                            {unpinnedChats.map((chat) => (
                                <ChatCard
                                    key={chat._id}
                                    chat={chat}
                                    isActive={activeChat?._id === chat._id}
                                    isPinned={false}
                                    currentUserId={user?._id}
                                    onSelect={() => handleSelectChat(chat)}
                                    onPin={() => togglePinChat(chat._id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {isProfileOpen && (
                <ProfileModal
                    isOpen={isProfileOpen}
                    onClose={() => setIsProfileOpen(false)}
                    onSave={() => setIsProfileOpen(false)}
                />
            )}

            {(user?.role === "master_admin" || user?.role === "co_admin") ? (
                <div className="sidebar-footer-container">
                    <button className="sidebar-admin-btn" style={{ margin: 0, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }} onClick={handleInviteClick}>
                        <InviteIcon size={18} />
                        Invite People
                    </button>
                    <div className="sidebar-footer-dual" style={{ margin: 0 }}>
                        <button className="footer-btn admin-btn" onClick={() => setIsAdminOpen(true)}>
                            <AdminIcon size={16} />
                            Admin
                        </button>
                        <button className="footer-btn faq-btn" onClick={() => setIsFAQOpen(true)}>
                            <HelpIcon size={16} />
                            FAQ
                        </button>
                    </div>
                </div>
            ) : (
                <div className="sidebar-footer-container sidebar-footer-container-dual">
                    <button className="footer-btn" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }} onClick={handleInviteClick}>
                        <InviteIcon size={16} />
                        Invite
                    </button>
                    <button className="footer-btn faq-btn" onClick={() => setIsFAQOpen(true)}>
                        <HelpIcon size={16} />
                        FAQ
                    </button>
                </div>
            )}

            {isAdminOpen && <AdminPanel onClose={() => setIsAdminOpen(false)} />}
            {isFAQOpen && <FAQModal isOpen={isFAQOpen} onClose={() => setIsFAQOpen(false)} />}
            {isE2EEInfoOpen && <E2EEInfoModal isOpen={isE2EEInfoOpen} onClose={() => setIsE2EEInfoOpen(false)} />}
            <InviteModal 
                isOpen={isInviteOpen} 
                onClose={() => setIsInviteOpen(false)} 
                username={user?.username} 
            />
            <ZenVaultModal 
                isOpen={isVaultOpen} 
                onClose={() => setIsVaultOpen(false)} 
            />
            <YourTimeDashboard
                isOpen={isYourTimeOpen}
                onClose={() => setIsYourTimeOpen(false)}
            />

            {showMobileMenu && createPortal(
                <div className={isMobile ? "mobile-bottom-sheet-overlay" : "modal-backdrop"} style={{ display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.4)", zIndex: 20000 }} onClick={() => setShowMobileMenu(false)}>
                    <div className={isMobile ? "mobile-bottom-sheet" : "modal-card"} onClick={(e) => e.stopPropagation()} style={isMobile ? { padding: "20px 20px 32px" } : { maxWidth: "340px", border: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(15, 23, 42, 0.9)", backdropFilter: "blur(20px)", padding: "24px", borderRadius: "16px", width: "100%" }}>
                        {isMobile && <div className="mobile-bottom-sheet-handle" />}
                        <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#f8fafc", marginBottom: "16px", textAlign: "center" }}>Menu</h3>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <button className="mobile-menu-btn" onClick={() => { setShowMobileMenu(false); setIsYourTimeOpen(true); }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <span>Your Time on ZenChat</span>
                            </button>
                            <div className="mobile-menu-divider" />
                            <button className="mobile-menu-btn" onClick={() => { setShowMobileMenu(false); setIsE2EEInfoOpen(true); }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                <span>E2EE Security Info</span>
                            </button>
                            <div className="mobile-menu-divider" />
                            <button className="mobile-menu-btn" onClick={() => { setShowMobileMenu(false); window.location.href = "/intro"; }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                                <span>ZenChat Home</span>
                            </button>
                            {!isStandalone && (
                                <>
                                    <div className="mobile-menu-divider" />
                                    <button className="mobile-menu-btn" onClick={() => { setShowMobileMenu(false); handlePwaButtonClick(); }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                        <span>{isPwaInstalled ? "Open App" : "Install App"}</span>
                                    </button>
                                </>
                            )}
                            <div className="mobile-menu-divider" />
                            <button className="mobile-menu-btn" onClick={() => { setShowMobileMenu(false); setIsVaultOpen(true); }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                <span>ZenVault Local Safe</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {showLogoutConfirm && (
                isMobile ? (
                    createPortal(
                        <div className="mobile-bottom-sheet-overlay" style={{ zIndex: 20000 }}>
                            <div className="mobile-bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ padding: "20px 20px 32px" }}>
                                <div className="mobile-bottom-sheet-handle" />
                                <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#f8fafc", marginBottom: "8px", textAlign: "center" }}>Confirm Sign Out</h3>
                                <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "24px", lineHeight: "1.5", textAlign: "center" }}>Are you sure you want to log out of ZenChat? You will need your credentials to sign back in.</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                                    <button
                                        className="btn"
                                        onClick={() => {
                                            setShowLogoutConfirm(false);
                                            logout();
                                        }}
                                        style={{ width: "100%", padding: "12px", borderRadius: "12px", background: "#ef4444", border: "none", color: "#fff", cursor: "pointer", fontWeight: "600", fontSize: "0.95rem" }}
                                    >
                                        Log Out
                                    </button>
                                    <button
                                        className="btn"
                                        onClick={() => setShowLogoutConfirm(false)}
                                        style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#cbd5e1", cursor: "pointer", fontSize: "0.95rem" }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )
                ) : (
                    createPortal(
                        <div className="modal-backdrop" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.4)", zIndex: 20000 }}>
                            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "380px", border: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(15, 23, 42, 0.9)", backdropFilter: "blur(20px)", padding: "24px", borderRadius: "16px", textAlign: "center" }}>
                                <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#f8fafc", marginBottom: "12px" }}>Confirm Sign Out</h3>
                                <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "24px", lineHeight: "1.5" }}>Are you sure you want to log out of ZenChat? You will need your credentials to sign back in.</p>
                                <div style={{ display: "flex", gap: "12px" }}>
                                    <button
                                        className="btn"
                                        onClick={() => setShowLogoutConfirm(false)}
                                        style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#cbd5e1", cursor: "pointer" }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn"
                                        onClick={() => {
                                            setShowLogoutConfirm(false);
                                            logout();
                                        }}
                                        style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "#ef4444", border: "none", color: "#fff", cursor: "pointer", fontWeight: "600" }}
                                    >
                                        Log Out
                                    </button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )
                )
            )}
        </div>
    );
};

export default memo(Sidebar);