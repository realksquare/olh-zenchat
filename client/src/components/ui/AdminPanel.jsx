import { useState, useEffect } from "react";
import axiosInstance from "../../utils/axios";
import { useAuthStore } from "../../stores/authStore";

const AdminPanel = ({ onClose }) => {
    const { user: me } = useAuthStore();
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("stats"); // "stats" | "users"

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

    if (loading) return (
        <div className="admin-modal-overlay">
            <div className="admin-modal-content">
                <div className="loader" />
            </div>
        </div>
    );

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
                <div className="admin-header">
                    <h2>Admin Dashboard</h2>
                    <button className="admin-close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="admin-tabs">
                    <button className={activeTab === "stats" ? "active" : ""} onClick={() => setActiveTab("stats")}>Overview</button>
                    <button className={activeTab === "users" ? "active" : ""} onClick={() => setActiveTab("users")}>Manage Users</button>
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
                                                <div className="user-cell">
                                                    <span className="user-name">{u.username}</span>
                                                    <span className="user-email">{u.email}</span>
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
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
