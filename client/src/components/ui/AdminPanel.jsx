import { useState, useEffect } from "react";
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

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 5000);
    };

    const fetchAdminData = async () => {
        try {
            setLoading(true);
            const [statsRes, usersRes] = await Promise.all([
                axiosInstance.get("/admin/stats"),
                axiosInstance.get("/admin/users")
            ]);
            setStats(statsRes.data);
            setUsers(usersRes.data.users);
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

    if (loading) return (
        <div className="admin-modal-overlay">
            <div className="admin-modal-content">
                <div className="loader" />
            </div>
        </div>
    );

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            {toast && <div className="aura-toast" style={{ zIndex: 9999 }}>🔔 {toast}</div>}
            <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
                <div className="admin-header">
                    <h2>Admin Dashboard</h2>
                    <button className="admin-close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="admin-tabs">
                    <button className={activeTab === "stats" ? "active" : ""} onClick={() => setActiveTab("stats")}>Overview</button>
                    <button className={activeTab === "users" ? "active" : ""} onClick={() => setActiveTab("users")}>Manage Users</button>
                    <button className={activeTab === "push" ? "active" : ""} onClick={() => setActiveTab("push")}>Push Notifs</button>
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
                                                            {u.fcmTokens?.length > 0 && (
                                                                <svg title="Subscribed to push" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '6px', verticalAlign: 'middle', display: 'inline-block' }}>
                                                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                                                </svg>
                                                            )}
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
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
