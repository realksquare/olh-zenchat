import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axios';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';

const ZenVoiceInvitePage = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { token: authToken, login } = useAuthStore();
    const [roomInfo, setRoomInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Auth form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchPreview = async () => {
            try {
                const res = await axiosInstance.get(`/zenvoice/rooms/invite/${token}/preview`);
                setRoomInfo(res.data.room);
                setLoading(false);
            } catch (err) {
                setError(err.response?.data?.message || 'Invalid or expired invite link.');
                setLoading(false);
            }
        };
        fetchPreview();
    }, [token]);

    const handleJoinIfLoggedIn = async () => {
        try {
            setIsSubmitting(true);
            navigate(`/?zvInvite=${token}`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to join room.');
            setIsSubmitting(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const res = await axiosInstance.post('/auth/zenvoice-signup', {
                academicEmail: email,
                password
            });
            if (res.data.token) {
                useAuthStore.getState().setToken(res.data.token);
                useAuthStore.getState().updateUser(res.data.user);
                localStorage.setItem('zenchat_token', res.data.token);
                localStorage.setItem('zenchat_user', JSON.stringify(res.data.user));
                
                navigate(`/?zvInvite=${token}`);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Signup failed.');
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#0f172a]">
                <div style={{ width: '40px', height: '40px', border: '3px solid #1e293b', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
        );
    }

    if (error && !roomInfo) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#0f172a] p-4">
                <div className="text-center p-8 bg-[#1e293b] rounded-2xl max-w-md w-full border border-red-500/30">
                    <h2 className="text-2xl font-bold text-red-400 mb-4">Oops!</h2>
                    <p className="text-slate-300">{error}</p>
                    <button 
                        onClick={() => navigate('/')}
                        className="mt-6 w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-semibold transition-colors"
                    >
                        Go to ZenChat
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-[#1e293b] rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50">
                <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-8 text-center border-b border-slate-700/50">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 mb-4">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">You've been invited!</h1>
                    <p className="text-slate-400">Join <span className="font-semibold text-blue-400">#{roomInfo?.name}</span> on ZenVoice</p>
                </div>

                <div className="p-8">
                    {authToken ? (
                        <div className="text-center">
                            <p className="text-slate-300 mb-6">You're already logged in to ZenChat.</p>
                            <button
                                onClick={handleJoinIfLoggedIn}
                                disabled={isSubmitting}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5"
                            >
                                {isSubmitting ? 'Joining...' : 'Join Room'}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSignup} className="space-y-4">
                            <div className="text-center mb-6">
                                <p className="text-sm text-slate-400">Enter your academic email to join anonymously.</p>
                            </div>
                            
                            {error && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Academic Email</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="student@university.edu"
                                    className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Create a password"
                                    className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? 'Creating Account...' : 'Continue to ZenVoice'}
                            </button>

                            <div className="mt-6 text-center text-sm text-slate-500">
                                Already have a ZenChat account? <button type="button" onClick={() => navigate(`/login?returnTo=/zenvoice/invite/${token}`)} className="text-blue-400 hover:text-blue-300 font-medium">Log in</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ZenVoiceInvitePage;
