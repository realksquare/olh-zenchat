import { useState, useEffect } from "react";
import { useZenVoiceStore } from "../../stores/zenVoiceStore";
import { useAuthStore } from "../../stores/authStore";
import { Plus, Search, Globe, Lock, Users, ArrowLeft, Copy, Check, MessageSquare, Loader2 } from "lucide-react";

const ZenVoiceRoomBrowser = ({ onBack, onRoomSelect }) => {
    const {
        rooms,
        fetchRooms,
        createRoom,
        searchRooms,
        joinRoom,
        isLoading,
        collegeEmailDomain,
        sessionToken,
        pseudonym,
        pseudonymColor,
        collegeName,
        profileData,
        fetchMyProfile,
        updateBio,
        requestPseudonymChange
    } = useZenVoiceStore();

    const { user } = useAuthStore();
    const isAdmin = user?.role === "master_admin" || user?.role === "co_admin";

    const [activeTab, setActiveTab] = useState(() => localStorage.getItem("zenvoice_active_tab") || "official"); // "official" | "private"
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreatingOfficial, setIsCreatingOfficial] = useState(false);
    
    // Create room form state
    const [newRoomName, setNewRoomName] = useState("");
    const [newRoomDesc, setNewRoomDesc] = useState("");
    const [lockToDomain, setLockToDomain] = useState(false);
    const [createdRoom, setCreatedRoom] = useState(null);
    const [copied, setCopied] = useState(false);
    const [formError, setFormError] = useState("");

    const [showMyProfile, setShowMyProfile] = useState(false);
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [tempBio, setTempBio] = useState("");
    const [isRequestingName, setIsRequestingName] = useState(false);
    const [newName, setNewName] = useState("");

    useEffect(() => {
        if (sessionToken && showMyProfile) {
            fetchMyProfile().then(data => {
                if (data) setTempBio(data.bio || "");
            });
        }
    }, [fetchMyProfile, sessionToken, showMyProfile]);

    const handleSaveBio = async () => {
        const res = await updateBio(tempBio);
        if (res.success) {
            setIsEditingBio(false);
        } else {
            alert(res.message || "Failed to update bio");
        }
    };

    const handleRequestName = async () => {
        if (!newName.trim()) return;
        const res = await requestPseudonymChange(newName.trim());
        if (res.success) {
            setIsRequestingName(false);
            setNewName("");
        } else {
            alert(res.message || "Failed to request pseudonym change");
        }
    };

    useEffect(() => {
        if (sessionToken) {
            fetchRooms();
        }
    }, [fetchRooms, sessionToken]);

    // Handle search query
    useEffect(() => {
        if (activeTab !== "official" || !searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        const delayDebounce = setTimeout(async () => {
            setIsSearching(true);
            const results = await searchRooms(searchQuery.trim());
            setSearchResults(results);
            setIsSearching(false);
        }, 3000); // 3s debounce as per search patterns

        return () => clearTimeout(delayDebounce);
    }, [searchQuery, activeTab, searchRooms]);

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        setFormError("");
        if (!newRoomName.trim()) {
            setFormError("Room name is required.");
            return;
        }

        const res = await createRoom(newRoomName.trim(), newRoomDesc.trim(), isCreatingOfficial ? true : lockToDomain, isCreatingOfficial);
        if (res.success) {
            setCreatedRoom(res.room);
            setNewRoomName("");
            setNewRoomDesc("");
            setLockToDomain(false);
        } else {
            setFormError(res.message || "Failed to create room.");
        }
    };

    const copyInviteLink = () => {
        if (!createdRoom) return;
        const link = `${window.location.origin}/zenvoice/invite/${createdRoom.inviteToken}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSelectRoom = async (room) => {
        if (!room) return;
        const myPseudonym = useZenVoiceStore.getState().pseudonym;
        const membersList = room.members || [];
        // If official room and we are not in its members list, join first
        if (room.isOfficial && !membersList.includes(myPseudonym)) {
            await joinRoom(room._id);
        }
        onRoomSelect(room._id);
    };

    const officialRooms = rooms.filter(r => r.isOfficial);
    const privateRooms = rooms.filter(r => !r.isOfficial);

    const displayedRooms = searchQuery.trim() && activeTab === "official" ? searchResults : (activeTab === "official" ? officialRooms : privateRooms);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--body-bg, #0b0f19)" }}>
            {/* Header */}
            <div style={{ padding: "16px", borderBottom: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--color-surface, #0f172a)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                    <button
                        onClick={onBack}
                        style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px", flexShrink: 0 }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    
                    {/* Own Profile Chip */}
                    <div
                        onClick={() => setShowMyProfile(true)}
                        style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: pseudonymColor || "#f59e0b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            flexShrink: 0,
                            border: "2px solid var(--color-border, rgba(255, 255, 255, 0.15))"
                        }}
                        title="My ZenVoice Profile"
                    >
                        <span style={{ color: "#000", fontSize: "0.8rem", fontWeight: "bold" }}>
                            {(pseudonym || "ME").slice(0, 2).toUpperCase()}
                        </span>
                    </div>

                    <h1 style={{ fontSize: "1.2rem", fontWeight: "700", margin: 0, color: "var(--color-text, #fff)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#ZenVoice</h1>
                </div>

                {activeTab === "private" ? (
                    <button
                        onClick={() => { setIsCreateOpen(true); setIsCreatingOfficial(false); setCreatedRoom(null); setFormError(""); }}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            background: "#f59e0b",
                            border: "none",
                            color: "#000",
                            fontWeight: "600",
                            fontSize: "0.78rem",
                            cursor: "pointer",
                            flexShrink: 0
                        }}
                    >
                        <Plus size={14} />
                        <span>New Private</span>
                    </button>
                ) : isAdmin ? (
                    <button
                        onClick={() => { setIsCreateOpen(true); setIsCreatingOfficial(true); setCreatedRoom(null); setFormError(""); }}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            background: "var(--color-primary, #3da5d9)",
                            border: "none",
                            color: "#fff",
                            fontWeight: "600",
                            fontSize: "0.78rem",
                            cursor: "pointer",
                            flexShrink: 0
                        }}
                    >
                        <Plus size={14} />
                        <span>New Official</span>
                    </button>
                ) : null}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", background: "var(--color-surface, #0f172a)", borderBottom: "1px solid var(--color-border, rgba(255, 255, 255, 0.05))" }}>
                <button
                    onClick={() => { setActiveTab("official"); localStorage.setItem("zenvoice_active_tab", "official"); setSearchQuery(""); }}
                    style={{
                        flex: 1,
                        padding: "14px 10px",
                        background: "none",
                        border: "none",
                        color: activeTab === "official" ? "#f59e0b" : "#64748b",
                        fontWeight: "600",
                        fontSize: "0.9rem",
                        borderBottom: activeTab === "official" ? "2px solid #f59e0b" : "2px solid transparent",
                        cursor: "pointer",
                        transition: "0.2s"
                    }}
                >
                    Verified Channels
                </button>
                <button
                    onClick={() => { setActiveTab("private"); localStorage.setItem("zenvoice_active_tab", "private"); setSearchQuery(""); }}
                    style={{
                        flex: 1,
                        padding: "14px 10px",
                        background: "none",
                        border: "none",
                        color: activeTab === "private" ? "#f59e0b" : "#64748b",
                        fontWeight: "600",
                        fontSize: "0.9rem",
                        borderBottom: activeTab === "private" ? "2px solid #f59e0b" : "2px solid transparent",
                        cursor: "pointer",
                        transition: "0.2s"
                    }}
                >
                    Student Hideouts
                </button>
            </div>

            {/* Search Bar for Official Rooms */}
            {activeTab === "official" && (
                <div style={{ padding: "12px 16px", position: "relative" }}>
                    <Search size={16} style={{ position: "absolute", left: "28px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    <input
                        type="text"
                        placeholder={`Find rooms on @${collegeEmailDomain || "domain"}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "10px 12px 10px 36px",
                            borderRadius: "8px",
                            border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                            background: "var(--color-surface-offset, #161b22)",
                            color: "var(--color-text, #fff)",
                            fontSize: "0.85rem",
                            outline: "none",
                            boxSizing: "border-box"
                        }}
                    />
                </div>
            )}

            {/* Room List Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                {isLoading && displayedRooms.length === 0 ? (
                    <div style={{ display: "flex", justifyValue: "center", justifyContent: "center", padding: "40px" }}>
                        <Loader2 className="animate-spin" style={{ animation: "spin 1s linear infinite", color: "#f59e0b" }} size={24} />
                    </div>
                ) : displayedRooms.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", textAlign: "center", gap: "12px" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--color-surface-offset, #161b22)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <MessageSquare size={20} style={{ color: "#64748b" }} />
                        </div>
                        <span style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.88rem" }}>
                            {activeTab === "official" ? "Nothing official here. Admins probably forgot to set up channels." : "Zero private rooms found. Start your own hideout and share the link."}
                        </span>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {displayedRooms.map(room => (
                            <div
                                key={room._id}
                                onClick={() => handleSelectRoom(room)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "16px",
                                    background: "var(--color-surface-offset, #161b22)",
                                    border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                    borderRadius: "12px",
                                    cursor: "pointer",
                                    transition: "0.2s"
                                }}
                                className="hover-card"
                            >
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px", textAlign: "left" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ fontWeight: "600", color: "var(--color-text, #fff)", fontSize: "0.95rem" }}>{room.name}</span>
                                        {room.allowedDomain ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: "3px", background: "var(--color-surface, #0f172a)", border: "1px solid rgba(56, 189, 248, 0.2)", padding: "2px 6px", borderRadius: "4px" }}>
                                                <Lock size={10} style={{ color: "#38bdf8" }} />
                                                <span style={{ fontSize: "0.65rem", color: "#38bdf8", fontWeight: "600" }}>College Locked</span>
                                            </div>
                                        ) : (
                                            <div style={{ display: "flex", alignItems: "center", gap: "3px", background: "var(--color-surface, #0f172a)", border: "1px solid rgba(245, 158, 11, 0.2)", padding: "2px 6px", borderRadius: "4px" }}>
                                                <Globe size={10} style={{ color: "#f59e0b" }} />
                                                <span style={{ fontSize: "0.65rem", color: "#f59e0b", fontWeight: "600" }}>Public</span>
                                            </div>
                                        )}
                                    </div>
                                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-muted, #94a3b8)" }}>{room.description || "No description. They're keeping it mysterious."}</p>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#64748b", fontSize: "0.8rem" }}>
                                    <Users size={14} />
                                    <span>{room.memberCount || 0}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Room Modal */}
            {isCreateOpen && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.6)", zIndex: 110000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", maxWidth: "400px", background: "var(--color-surface, #0f172a)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", padding: "24px", borderRadius: "16px", position: "relative" }}>
                        <h3 style={{ margin: "0 0 16px", color: "var(--color-text, #fff)", fontSize: "1.1rem", fontWeight: "700" }}>
                            {createdRoom 
                                ? (isCreatingOfficial ? "Official Channel Created" : "Private Room Created") 
                                : (isCreatingOfficial ? "Create Official Channel" : "Create Private Room")
                            }
                        </h3>
                        <button
                            onClick={() => setIsCreateOpen(false)}
                            style={{ position: "absolute", right: "20px", top: "20px", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1.5rem" }}
                        >
                            &times;
                        </button>

                        {createdRoom ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "center" }}>
                                <p style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.88rem", lineHeight: "1.5", margin: 0 }}>
                                    {isCreatingOfficial ? (
                                        <>Official channel <strong style={{ color: "var(--color-text, #fff)" }}>{createdRoom.name}</strong> is ready. Students can find and join it from the browser.</>
                                    ) : (
                                        <>Your secret room <strong style={{ color: "var(--color-text, #fff)" }}>{createdRoom.name}</strong> is ready. Throw this invite link at your peers:</>
                                    )}
                                </p>
                                
                                {!isCreatingOfficial && (
                                    <div style={{ display: "flex", alignItems: "center", background: "var(--color-surface-offset, #161b22)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", borderRadius: "8px", padding: "8px 12px" }}>
                                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.8rem", color: "var(--color-text-faint, #64748b)", textAlign: "left" }}>
                                            {window.location.origin}/zenvoice/invite/{createdRoom.inviteToken}
                                        </span>
                                        <button
                                            onClick={copyInviteLink}
                                            style={{ background: "none", border: "none", color: copied ? "#10b981" : "#f59e0b", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                                        >
                                            {copied ? <Check size={16} /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                )}

                                <button
                                    onClick={() => { setIsCreateOpen(false); handleSelectRoom(createdRoom); }}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        borderRadius: "8px",
                                        background: isCreatingOfficial ? "var(--color-primary, #3da5d9)" : "#f59e0b",
                                        border: "none",
                                        color: isCreatingOfficial ? "#fff" : "#000",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                        fontSize: "0.9rem",
                                        marginTop: "8px"
                                    }}
                                >
                                    Enter Room
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleCreateRoom} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div style={{ textAlign: "left" }}>
                                    <label style={{ fontSize: "0.8rem", color: "var(--color-text-muted, #94a3b8)", display: "block", marginBottom: "4px" }}>What should we call this room?</label>
                                    <input
                                        type="text"
                                        placeholder={isCreatingOfficial ? "e.g. Announcements / Tech Talks" : "e.g. Gossip Central / Study Group"}
                                        value={newRoomName}
                                        onChange={(e) => setNewRoomName(e.target.value)}
                                        maxLength={40}
                                        required
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            borderRadius: "8px",
                                            border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                            background: "var(--color-surface-offset, #161b22)",
                                            color: "var(--color-text, #fff)",
                                            fontSize: "0.85rem",
                                            outline: "none",
                                            boxSizing: "border-box"
                                        }}
                                    />
                                </div>
 
                                <div style={{ textAlign: "left" }}>
                                    <label style={{ fontSize: "0.8rem", color: "var(--color-text-muted, #94a3b8)", display: "block", marginBottom: "4px" }}>Tell them what this room is for... (keep it brief)</label>
                                    <textarea
                                        placeholder="What goes on in here?"
                                        value={newRoomDesc}
                                        onChange={(e) => setNewRoomDesc(e.target.value)}
                                        maxLength={150}
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            borderRadius: "8px",
                                            border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
                                            background: "var(--color-surface-offset, #161b22)",
                                            color: "var(--color-text, #fff)",
                                            fontSize: "0.85rem",
                                            minHeight: "60px",
                                            resize: "vertical",
                                            outline: "none",
                                            boxSizing: "border-box",
                                            fontFamily: "inherit"
                                        }}
                                    />
                                </div>

                                {!isCreatingOfficial && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "transparent", padding: "10px 0" }}>
                                        <input
                                            type="checkbox"
                                            id="lockDomain"
                                            checked={lockToDomain}
                                            onChange={(e) => setLockToDomain(e.target.checked)}
                                            style={{ cursor: "pointer" }}
                                        />
                                        <label htmlFor="lockDomain" style={{ fontSize: "0.8rem", color: "var(--color-text, #cbd5e1)", cursor: "pointer", textAlign: "left", userSelect: "none" }}>
                                            Only let people from @{collegeEmailDomain || "domain"} join
                                        </label>
                                    </div>
                                )}

                                {formError && (
                                    <div style={{ padding: "8px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "6px", color: "#ef4444", fontSize: "0.78rem" }}>
                                        {formError}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        borderRadius: "8px",
                                        background: isCreatingOfficial ? "var(--color-primary, #3da5d9)" : "#f59e0b",
                                        border: "none",
                                        color: isCreatingOfficial ? "#fff" : "#000",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                        fontSize: "0.9rem",
                                        marginTop: "8px"
                                    }}
                                >
                                    Create Room
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* My ZenVoice Profile Modal */}
            {showMyProfile && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.6)", zIndex: 110000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", maxWidth: "360px", background: "var(--color-surface, #0f172a)", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", padding: "24px", borderRadius: "16px", position: "relative", color: "var(--color-text, #fff)" }}>
                        <button
                            onClick={() => setShowMyProfile(false)}
                            style={{ position: "absolute", right: "20px", top: "20px", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1.5rem" }}
                        >
                            &times;
                        </button>
                        
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", textAlign: "center", marginBottom: "20px" }}>
                            <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: pseudonymColor || "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ color: "#000", fontWeight: "bold", fontSize: "1.3rem" }}>{(pseudonym || "ME").slice(0, 2).toUpperCase()}</span>
                            </div>
                            <h3 style={{ margin: "4px 0 2px", fontWeight: "700" }}>{pseudonym}</h3>
                            <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#10b981", fontSize: "0.72rem", padding: "2px 8px", borderRadius: "12px", fontWeight: "600" }}>
                                Verified Peer
                            </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "0.85rem", textAlign: "left" }}>
                            <div>
                                <span style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.78rem", display: "block" }}>College / Institution</span>
                                <span style={{ fontWeight: "600" }}>{collegeName || "Unknown Institution"}</span>
                            </div>

                            <div>
                                <span style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.78rem", display: "block" }}>Student Domain</span>
                                <span style={{ fontWeight: "600" }}>@{collegeEmailDomain || "domain"}</span>
                            </div>

                            <div>
                                <span style={{ color: "var(--color-text-muted, #94a3b8)", fontSize: "0.78rem", display: "block", marginBottom: "4px" }}>My Bio</span>
                                {isEditingBio ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        <textarea
                                            value={tempBio}
                                            onChange={(e) => setTempBio(e.target.value)}
                                            maxLength={100}
                                            style={{
                                                width: "100%",
                                                padding: "8px",
                                                borderRadius: "6px",
                                                border: "1px solid var(--color-border, rgba(255, 255, 255, 0.1))",
                                                background: "var(--color-surface-offset, #161b22)",
                                                color: "var(--color-text, #fff)",
                                                fontSize: "0.85rem",
                                                minHeight: "44px",
                                                resize: "vertical",
                                                fontFamily: "inherit",
                                                boxSizing: "border-box",
                                                outline: "none"
                                            }}
                                        />
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button
                                                onClick={handleSaveBio}
                                                style={{ padding: "4px 10px", borderRadius: "4px", background: "#f59e0b", border: "none", color: "#000", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer" }}
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setIsEditingBio(false)}
                                                style={{ padding: "4px 10px", borderRadius: "4px", background: "transparent", border: "1px solid var(--color-border, rgba(255,255,255,0.1))", color: "#cbd5e1", fontSize: "0.75rem", cursor: "pointer" }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", background: "var(--color-surface-offset, #161b22)", padding: "8px 10px", borderRadius: "6px" }}>
                                        <span style={{ fontStyle: tempBio ? "normal" : "italic", color: tempBio ? "var(--color-text)" : "var(--color-text-muted)" }}>
                                            {tempBio || "Tell them something sarcastic..."}
                                        </span>
                                        <button
                                            onClick={() => setIsEditingBio(true)}
                                            style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", fontSize: "0.75rem", padding: "2px" }}
                                        >
                                            Edit
                                        </button>
                                    </div>
                                )}
                            </div>

                            {profileData?.redCardCount > 0 && (
                                <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", padding: "10px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                                    <span style={{ fontSize: "1.1rem" }}>⚠️</span>
                                    <div>
                                        <div style={{ fontWeight: "700", color: "#ef4444", fontSize: "0.8rem" }}>Red Cards: {profileData.redCardCount}</div>
                                        <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted, #94a3b8)", marginTop: "2px" }}>You have been flagged for trash content. Exponential timeouts apply. Keep it clean.</div>
                                    </div>
                                </div>
                            )}

                            <div style={{ borderTop: "1px solid var(--color-border, rgba(255, 255, 255, 0.05))", paddingTop: "14px", marginTop: "6px" }}>
                                {profileData?.pseudonymChangeRequest?.requested ? (
                                    <div style={{ background: "var(--color-surface-offset, #161b22)", padding: "10px", borderRadius: "8px", fontSize: "0.78rem", color: "var(--color-text-muted, #94a3b8)" }}>
                                        <span>Pseudonym change request to <strong>{profileData.pseudonymChangeRequest.desiredPseudonym}</strong> is <strong>{profileData.pseudonymChangeRequest.status}</strong>.</span>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted, #94a3b8)" }}>Want a new identity?</span>
                                        {isRequestingName ? (
                                            <div style={{ display: "flex", gap: "6px" }}>
                                                <input
                                                    type="text"
                                                    placeholder="Desired pseudonym"
                                                    value={newName}
                                                    onChange={(e) => setNewName(e.target.value)}
                                                    style={{ flex: 1, padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--color-border, rgba(255,255,255,0.1))", background: "var(--color-surface-offset, #161b22)", color: "#fff", fontSize: "0.8rem", outline: "none" }}
                                                />
                                                <button
                                                    onClick={handleRequestName}
                                                    style={{ padding: "6px 10px", borderRadius: "4px", background: "#f59e0b", border: "none", color: "#000", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer" }}
                                                >
                                                    Submit
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setIsRequestingName(true)}
                                                style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "transparent", border: "1px dashed var(--color-border, rgba(255,255,255,0.15))", color: "#f59e0b", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer" }}
                                            >
                                                Request Pseudonym Change
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZenVoiceRoomBrowser;
