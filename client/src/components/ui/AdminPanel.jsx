import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axiosInstance from "../../utils/axios";
import { useAuthStore } from "../../stores/authStore";

const AdminPanel = ({ onClose }) => {
    const { user: me } = useAuthStore();
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("stats"); // "stats" | "users" | "push"
    const [pushTitle, setPushTitle] = useState("");
    const [pushBody, setPushBody] = useState("");
    const [pushSending, setPushSending] = useState(false);
    const [toast, setToast] = useState(null);

    // ZenPulse Admin State
    const [pulseQuestion, setPulseQuestion] = useState("");
    const [pulseOption1, setPulseOption1] = useState("");
    const [pulseOption2, setPulseOption2] = useState("");
    const [pulseOption3, setPulseOption3] = useState("");
    const [pulseOption4, setPulseOption4] = useState("");
    const [pulseDate, setPulseDate] = useState("");
    const [scheduledPulses, setScheduledPulses] = useState([]);
    const [isSchedulingPulse, setIsSchedulingPulse] = useState(false);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const fetchAdminData = async () => {
        try {
            setLoading(true);
            const [statsRes, usersRes, pulseRes] = await Promise.all([
                axiosInstance.get("/admin/stats"),
                axiosInstance.get("/admin/users"),
                axiosInstance.get("/pulse/admin/questions")
            ]);
            setStats(statsRes.data);
            setUsers(usersRes.data.users);
            setScheduledPulses(pulseRes.data.questions || []);
        } catch (err) {
            console.error("Admin fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, []);

    useEffect(() => {
        fetchAdminData();
    }, []);

    const handleToggleVerify = async (userId) => {
        try {
            const { data } = await axiosInstance.post(`/admin/verify/${userId}`);
            setUsers(users.map(u => u._id === userId ? { ...u, isVerified: data.user.isVerified } : u));
        } catch (err) { alert(err.response?.data?.message || "Failed"); }
    };

    const handleToggleSuspend = async (userId) => {
        try {
            const { data } = await axiosInstance.post(`/admin/suspend/${userId}`);
            setUsers(users.map(u => u._id === userId ? { ...u, isSuspended: data.user.isSuspended } : u));
        } catch (err) { alert(err.response?.data?.message || "Failed"); }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm("Are you sure? This is permanent.")) return;
        try {
            await axiosInstance.delete(`/admin/users/${userId}`);
            setUsers(users.filter(u => u._id !== userId));
        } catch (err) { alert(err.response?.data?.message || "Failed"); }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            const { data } = await axiosInstance.post(`/admin/role/${userId}`, { role: newRole });
            setUsers(users.map(u => u._id === userId ? { ...u, role: data.user.role } : u));
        } catch (err) { alert(err.response?.data?.message || "Failed"); }
    };

    const handleSendPush = async () => {
        if (!pushTitle || !pushBody) return showToast("Title and body required!");
        setPushSending(true);
        try {
            const { data } = await axiosInstance.post("/admin/push", { title: pushTitle, body: pushBody });
            showToast(`Sent to ${data.sentCount} devices successfully!`);
            setPushTitle("");
            setPushBody("");
        } catch (err) {
            showToast(err.response?.data?.message || "Failed to send push notification");
        } finally {
            setPushSending(false);
        }
    };

    const handleSchedulePulse = async () => {
        if (!pulseQuestion || !pulseOption1 || !pulseOption2 || !pulseDate) return showToast("Required fields missing");
        setIsSchedulingPulse(true);
        try {
            const options = [
                { id: "opt1", text: pulseOption1 },
                { id: "opt2", text: pulseOption2 }
            ];
            if (pulseOption3) options.push({ id: "opt3", text: pulseOption3 });
            if (pulseOption4) options.push({ id: "opt4", text: pulseOption4 });

            const { data } = await axiosInstance.post("/pulse/admin/questions", {
                question: pulseQuestion,
                options,
                scheduledFor: new Date(pulseDate).toISOString()
            });

            setScheduledPulses([...scheduledPulses, data.question].sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor)));
            showToast("Pulse scheduled successfully!");
            setPulseQuestion("");
            setPulseOption1("");
            setPulseOption2("");
            setPulseOption3("");
            setPulseOption4("");
            setPulseDate("");
        } catch (err) {
            showToast(err.response?.data?.message || "Failed to schedule pulse");
        } finally {
            setIsSchedulingPulse(false);
        }
    };

    const handleDeletePulse = async (id) => {
        if (!window.confirm("Delete this scheduled pulse?")) return;
        try {
            await axiosInstance.delete(`/pulse/admin/questions/${id}`);
            setScheduledPulses(scheduledPulses.filter(p => p._id !== id));
            showToast("Pulse deleted");
        } catch (err) {
            showToast(err.response?.data?.message || "Failed to delete pulse");
        }
    };

    if (loading) return createPortal(
        <div className="admin-modal-overlay">
            <div className="admin-modal-content">
                <div className="loader" />
            </div>
        </div>,
        document.body
    );
    // Calculate minimum allowed date for ZenPulse (cannot be older than today, or tomorrow if past 7 PM)
    const minPulseDate = new Date();
    if (minPulseDate.getHours() >= 19) {
        minPulseDate.setDate(minPulseDate.getDate() + 1);
    }
    const minPulseDateString = minPulseDate.toISOString().split("T")[0];

    return createPortal(
        <div className="admin-modal-overlay">
            {toast && <div className="zen-toast zen-toast-info" style={{ pointerEvents: 'none' }}>{toast}</div>}
            <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
                <div className="admin-header">
                    <h2>Admin Dashboard</h2>
                    <button className="admin-close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="admin-tabs">
                    <button className={activeTab === "stats" ? "active" : ""} onClick={() => setActiveTab("stats")}>Overview</button>
                    <button className={activeTab === "users" ? "active" : ""} onClick={() => setActiveTab("users")}>Users</button>
                    <button className={activeTab === "push" ? "active" : ""} onClick={() => setActiveTab("push")}>Push Notifs</button>
                    <button className={activeTab === "pulse" ? "active" : ""} onClick={() => setActiveTab("pulse")}>ZenPulse</button>
                </div>

                <div className="admin-body">
                    {activeTab === "stats" && stats && (
                        <div className="admin-stats-grid">
                            <div className="stat-card">
                                <span className="stat-label">Total Users</span>
                                <span className="stat-value">{stats.totalUsers}</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-label">Active Today</span>
                                <span className="stat-value">{stats.dauCount}</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-label">Total Messages</span>
                                <span className="stat-value">{stats.messagesCount}</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-label">Server Status</span>
                                <div className="server-status">
                                    <div className="status-item">
                                        <span>Render:</span> <span className="status-online">{stats.serverStatus.render}</span>
                                    </div>
                                    <div className="status-item">
                                        <span>Vercel:</span> <span className="status-online">{stats.serverStatus.vercel}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "users" && (
                        <div className="admin-users-list">
                            <table>
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Role</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u._id} className={u.isSuspended ? "row-suspended" : ""}>
                                            <td>
                                                <div className="user-cell" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
                                                    <div className="avatar avatar-sm" style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                        {u.avatar ? (
                                                            <img src={u.avatar} alt={u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#94a3b8' }}>
                                                                {u.username?.slice(0, 2).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span className="user-name">
                                                            {u.username}
                                                            {(() => {
                                                                if (!u.fcmTokens?.length) return null;
                                                                const latest = u.fcmTokens.reduce((a, b) =>
                                                                    new Date(a.lastUpdated) >= new Date(b.lastUpdated) ? a : b
                                                                );
                                                                const label = latest.deviceType === 'pwa' ? 'Push: PWA' : 'Push: Browser';
                                                                return (
                                                                    <svg title={label} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '5px', verticalAlign: 'middle', display: 'inline-block', flexShrink: 0 }}>
                                                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                                                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                                                    </svg>
                                                                );
                                                            })()}
                                                        </span>
                                                        <span className="user-email">{u.email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <select 
                                                    value={u.role} 
                                                    onChange={(e) => handleRoleChange(u._id, e.target.value)}
                                                    disabled={u.username === "admin_krish" || (me.role !== "master_admin" && u.role === "co_admin")}
                                                >
                                                    <option value="user">User</option>
                                                    <option value="co_admin">Co-Admin</option>
                                                    <option value="master_admin">Master Admin</option>
                                                </select>
                                            </td>
                                            <td>
                                                <div className="action-btns">
                                                    <button 
                                                        className={u.isVerified ? "btn-verified" : "btn-unverified"}
                                                        onClick={() => handleToggleVerify(u._id)}
                                                    >
                                                        {u.isVerified ? "Verified" : "Verify"}
                                                    </button>
                                                    <button 
                                                        className="btn-suspend"
                                                        onClick={() => handleToggleSuspend(u._id)}
                                                        disabled={u.username === "admin_krish"}
                                                    >
                                                        {u.isSuspended ? "Unsuspend" : "Suspend"}
                                                    </button>
                                                    <button 
                                                        className="btn-delete"
                                                        onClick={() => handleDeleteUser(u._id)}
                                                        disabled={u.username === "admin_krish"}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === "push" && (
                        <div className="admin-push-section" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <h3 style={{ margin: 0, color: 'white' }}>Send Global Push Notification</h3>
                            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>This will broadcast a push notification to all subscribed users globally.</p>
                            <input 
                                type="text" 
                                placeholder="Notification Title (e.g. New Feature Update!)" 
                                value={pushTitle} 
                                onChange={e => setPushTitle(e.target.value)} 
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '1rem', outline: 'none' }}
                            />
                            <textarea 
                                placeholder="Notification Body" 
                                value={pushBody} 
                                onChange={e => setPushBody(e.target.value)} 
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: 'white', minHeight: '100px', resize: 'vertical', fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit' }}
                            />
                            <button 
                                onClick={handleSendPush} 
                                disabled={pushSending || !pushTitle || !pushBody} 
                                style={{ padding: '12px', borderRadius: '8px', background: '#3b82f6', color: 'white', fontWeight: 'bold', border: 'none', cursor: (pushSending || !pushTitle || !pushBody) ? 'not-allowed' : 'pointer', opacity: (pushSending || !pushTitle || !pushBody) ? 0.6 : 1, transition: '0.2s' }}
                            >
                                {pushSending ? "Sending..." : "Send Broadcast"}
                            </button>
                        </div>
                    )}

                    {activeTab === "pulse" && (
                        <div className="admin-pulse-section" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="pulse-create-form" style={{ background: 'rgba(30,41,59,0.5)', padding: '16px', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>Schedule New Pulse</h3>
                                <input type="text" placeholder="Question?" value={pulseQuestion} onChange={e => setPulseQuestion(e.target.value)} className="admin-pulse-input" />
                                <div className="pulse-options-grid">
                                    <input type="text" placeholder="Option 1 (Required)" value={pulseOption1} onChange={e => setPulseOption1(e.target.value)} className="admin-pulse-input" />
                                    <input type="text" placeholder="Option 2 (Required)" value={pulseOption2} onChange={e => setPulseOption2(e.target.value)} className="admin-pulse-input" />
                                    <input type="text" placeholder="Option 3 (Optional)" value={pulseOption3} onChange={e => setPulseOption3(e.target.value)} className="admin-pulse-input" />
                                    <input type="text" placeholder="Option 4 (Optional)" value={pulseOption4} onChange={e => setPulseOption4(e.target.value)} className="admin-pulse-input" />
                                </div>
                                <input type="date" value={pulseDate} onChange={e => setPulseDate(e.target.value)} min={minPulseDateString} className="admin-pulse-input" style={{ colorScheme: 'dark' }} title="Scheduled For (Date)" />
                                <button onClick={handleSchedulePulse} disabled={isSchedulingPulse} style={{ padding: '10px', borderRadius: '6px', background: '#10b981', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                                    {isSchedulingPulse ? "Scheduling..." : "Schedule Pulse"}
                                </button>
                            </div>

                            <div className="pulse-scheduled-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>All Pulses (Scheduled, Active & Completed)</h3>
                                {scheduledPulses.length === 0 ? (
                                    <p style={{ color: '#94a3b8' }}>No pulses in database.</p>
                                ) : (
                                    scheduledPulses.map(p => (
                                        <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ color: 'white', fontWeight: '500' }}>{p.question}</span>
                                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                                    {new Date(p.scheduledFor).toLocaleDateString()} • Status: <strong style={{ color: p.status === 'active' ? '#10b981' : '#3b82f6' }}>{p.status.toUpperCase()}</strong>
                                                </span>
                                            </div>
                                            <button onClick={() => handleDeletePulse(p._id)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>Delete</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AdminPanel;
