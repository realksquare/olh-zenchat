import React, { useState } from 'react';
import axiosInstance from '../../utils/axios';
import { useAuthStore } from '../../stores/authStore';

const ZenVoiceAccountPrompt = ({ onClose }) => {
    const [mode, setMode] = useState('prompt'); // 'prompt', 'upgrade', 'merge'
    const [username, setUsername] = useState('');
    const [mergeUsername, setMergeUsername] = useState('');
    const [mergePassword, setMergePassword] = useState('');
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const updateUser = useAuthStore(s => s.updateUser);
    const setToken = useAuthStore(s => s.setToken);

    const handleUpgrade = async (e) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            const res = await axiosInstance.post('/auth/upgrade-zenvoice', { username });
            updateUser(res.data.user);
            localStorage.setItem('zenchat_user', JSON.stringify(res.data.user));
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upgrade account.');
            setIsSubmitting(false);
        }
    };

    const handleMerge = async (e) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            const res = await axiosInstance.post('/auth/merge-zenvoice', {
                username: mergeUsername,
                password: mergePassword
            });
            setToken(res.data.token);
            updateUser(res.data.user);
            localStorage.setItem('zenchat_token', res.data.token);
            localStorage.setItem('zenchat_user', JSON.stringify(res.data.user));
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid credentials or failed to merge.');
            setIsSubmitting(false);
        }
    };

    const handleSeparate = () => {
        useAuthStore.getState().logout();
        window.location.href = '/register';
    };

    return (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1e293b] rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-700/50">
                
                {mode === 'prompt' && (
                    <div className="space-y-6">
                        <div className="text-center space-y-2">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 mb-2">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-white">Hold up...</h2>
                            <p className="text-sm text-slate-400">
                                You're rocking a ZenVoice-only account. Ready to unlock the whole ZenChat universe?
                            </p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => setMode('upgrade')}
                                className="w-full p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors text-sm flex items-center justify-between"
                            >
                                <span>Keep current login</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                            
                            <button
                                onClick={() => setMode('merge')}
                                className="w-full p-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors text-sm flex items-center justify-between"
                            >
                                <span>Merge with existing account</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>

                            <button
                                onClick={handleSeparate}
                                className="w-full p-4 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl font-medium transition-colors text-sm flex items-center justify-between"
                            >
                                <span>Start fresh (New account)</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                        </div>
                    </div>
                )}

                {mode === 'upgrade' && (
                    <form onSubmit={handleUpgrade} className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <button type="button" onClick={() => { setMode('prompt'); setError(null); }} className="text-slate-400 hover:text-white">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                            </button>
                            <h2 className="text-lg font-bold text-white">Choose Username</h2>
                        </div>
                        <p className="text-xs text-slate-400">Pick a unique username for ZenChat.</p>
                        
                        {error && <div className="text-red-400 text-xs bg-red-500/10 p-2 rounded">{error}</div>}
                        
                        <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username"
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:border-indigo-500 outline-none"
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium disabled:opacity-50"
                        >
                            {isSubmitting ? 'Upgrading...' : 'Continue'}
                        </button>
                    </form>
                )}

                {mode === 'merge' && (
                    <form onSubmit={handleMerge} className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <button type="button" onClick={() => { setMode('prompt'); setError(null); }} className="text-slate-400 hover:text-white">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                            </button>
                            <h2 className="text-lg font-bold text-white">Login to Merge</h2>
                        </div>
                        <p className="text-xs text-slate-400">Login to your existing ZenChat account to merge your ZenVoice access.</p>
                        
                        {error && <div className="text-red-400 text-xs bg-red-500/10 p-2 rounded">{error}</div>}
                        
                        <input
                            type="text"
                            required
                            value={mergeUsername}
                            onChange={(e) => setMergeUsername(e.target.value)}
                            placeholder="Username or Email"
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:border-indigo-500 outline-none mb-2"
                        />
                        <input
                            type="password"
                            required
                            value={mergePassword}
                            onChange={(e) => setMergePassword(e.target.value)}
                            placeholder="Password"
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:border-indigo-500 outline-none"
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium disabled:opacity-50"
                        >
                            {isSubmitting ? 'Merging...' : 'Login & Merge'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ZenVoiceAccountPrompt;
