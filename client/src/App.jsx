// ZenChat PWA Application Root
import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import { useChatStore } from "./stores/chatStore";
import { useMomentStore } from "./stores/momentStore";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import HomePage from "./pages/HomePage";
import InstallPWA from "./components/ui/InstallPWA";
import RecoveryKeyModal from "./components/ui/RecoveryKeyModal";
import { primeAudioContext, getAudioContext } from "./utils/audio";
import { requestNotificationPermission } from "./utils/firebase";
import axiosInstance from "./utils/axios";
import NotificationPrompt from "./components/layout/NotificationPrompt";
import SplashScreen from "./components/ui/SplashScreen";
import { useSocket } from "./context/SocketContext";

const ProtectedRoute = ({ children }) => {
  const token = useAuthStore((state) => state.token);
  return token ? children : <Navigate to="/login" replace />;
};

const GuestRoute = ({ children }) => {
  const token = useAuthStore((state) => state.token);
  return !token ? children : <Navigate to="/" replace />;
};

const NetworkBanner = () => {
  const socketContext = useSocket();
  const socket = socketContext?.socket;
  const isConnected = socketContext?.isConnected || false;
  const [status, setStatus] = useState("online");
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hideTimer = useRef(null);
  const reconnectTimer = useRef(null);

  const showBanner = (s) => {
    setDismissed(false);
    setStatus(s);
    setVisible(true);
    clearTimeout(hideTimer.current);
  };

  const hideBanner = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 2000);
  };

  useEffect(() => {
    const handleStatusChange = () => {
      const offline = !navigator.onLine;
      useChatStore.getState().setOffline(offline);
      clearTimeout(reconnectTimer.current);

      if (offline) {
        showBanner("offline");
      } else if (socket && !isConnected) {
        // Online but socket not yet reconnected
        showBanner("reconnecting");
      } else {
        showBanner("online");
        hideBanner();
      }
    };

    window.addEventListener("offline", handleStatusChange);
    window.addEventListener("online", handleStatusChange);
    
    if (socket) {
      socket.on("disconnect", handleStatusChange);
      socket.on("connect", handleStatusChange);
    }
    
    handleStatusChange();

    return () => {
      window.removeEventListener("offline", handleStatusChange);
      window.removeEventListener("online", handleStatusChange);
      if (socket) {
        socket.off("disconnect", handleStatusChange);
        socket.off("connect", handleStatusChange);
      }
      clearTimeout(hideTimer.current);
      clearTimeout(reconnectTimer.current);
    };
  }, [socket, isConnected]);

  if (!visible || dismissed) return null;
  if (status === "online") return null;

  return (
    <div className="network-banner" data-status={status} onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {status === "offline" ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
          <span style={{ flex: 1 }}>No connection</span>
        </>
      ) : (
        <>
          <span className="banner-spinner" />
          <span style={{ flex: 1 }}>{status === "reconnecting" ? "Reconnecting to server" : "Reconnecting"}</span>
        </>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        className="sp-op-toast-close"
        aria-label="Dismiss"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
};

const NetworkToast = () => {
  const isLowBandwidth = useChatStore((s) => s.isLowBandwidth);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastIsLow, setToastIsLow] = useState(false);
  const prevLowBandwidth = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    // Skip identical state (no change)
    if (prevLowBandwidth.current === isLowBandwidth) return;
    // On very first evaluation, only show if low (not on initial false)
    if (prevLowBandwidth.current === null) {
      prevLowBandwidth.current = isLowBandwidth;
      if (isLowBandwidth) {
        setToastMessage("Slow/unstable connection detected - #SP-OP mode activated");
        setToastIsLow(true);
        setToastVisible(true);
        timer.current = setTimeout(() => setToastVisible(false), 3000);
      }
      return;
    }

    clearTimeout(timer.current);
    if (isLowBandwidth) {
      setToastMessage("Slow/unstable connection detected - #SP-OP mode activated");
      setToastIsLow(true);
    } else {
      setToastMessage("Stable connection detected - #SP-OP mode deactivated");
      setToastIsLow(false);
    }
    setToastVisible(true);
    timer.current = setTimeout(() => setToastVisible(false), 3000);
    prevLowBandwidth.current = isLowBandwidth;
  }, [isLowBandwidth]);

  if (!toastVisible) return null;

  return (
    <div className="sp-op-toast" style={{
      border: toastIsLow ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
      color: toastIsLow ? '#fef08a' : '#a7f3d0'
    }}>
      {toastIsLow ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#eab308', flexShrink: 0 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#10b981', flexShrink: 0 }}>
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
      <span className="sp-op-toast-text">{toastMessage}</span>
      <button
        className="sp-op-toast-close"
        onClick={() => setToastVisible(false)}
        aria-label="Dismiss"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
};

const App = () => {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?._id);
  const user = useAuthStore((s) => s.user);
  const activeChat = useChatStore((s) => s.activeChat);
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const socketContext = useSocket();
  const socket = socketContext?.socket;
  const [serverReady, setServerReady] = useState(false);
  const prevTokenRef = useRef(token);
  const mountedRef = useRef(false);

  // Global ZenMode States and Refs from context
  const incomingZenInvite = socketContext?.incomingZenInvite;
  const setIncomingZenInvite = socketContext?.setIncomingZenInvite;
  const incomingZenExit = socketContext?.incomingZenExit;
  const setIncomingZenExit = socketContext?.setIncomingZenExit;
  const zenWaitingState = socketContext?.zenWaitingState;
  const setZenWaitingState = socketContext?.setZenWaitingState;
  const zenCountdown = socketContext?.zenCountdown;
  const zenToast = socketContext?.zenToast;
  const clearZenTimers = socketContext?.clearZenTimers;
  const startZenTimer = socketContext?.startZenTimer;
  const showExitConfirm = socketContext?.showExitConfirm;
  const setShowExitConfirm = socketContext?.setShowExitConfirm;

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevTokenRef.current = token;
      return;
    }
    if (token !== prevTokenRef.current) {
      prevTokenRef.current = token;
      window.location.reload();
    }
  }, [token]);

  useEffect(() => {
    if (token && userId) {
      const registerFCM = async () => {
        try {
          if (typeof window.Notification === 'undefined' || window.Notification.permission !== "granted") return;
          const fcmToken = await requestNotificationPermission();
          if (fcmToken) {
            const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
            await axiosInstance.put("/auth/me", {
              fcmToken,
              deviceType: isPWA ? "pwa" : "browser",
              notificationsEnabled: true
            });
          }
        } catch (err) {
          console.error("FCM registration error:", err);
        }
      };
      registerFCM();
    }
  }, [token, userId]);

    useEffect(() => {
    checkAuth();
        if (token) {
            useChatStore.getState().initLocalData();
            useChatStore.getState().fetchChats();
            useMomentStore.getState().fetchMoments();
        }

        const clearNotifications = async () => {
            try {
                if ('serviceWorker' in navigator) {
                    const registration = await navigator.serviceWorker.ready;
                    const notifications = await registration.getNotifications();
                    notifications.forEach(notification => notification.close());
                }
            } catch (err) {
                console.error("Error clearing notifications:", err);
            }
        };

        const updatePresence = () => {
            const isActive = document.visibilityState === "visible" && document.hasFocus();
            if (socket && socket.connected) {
                socket.emit("set_active_status", { isActive });
            }
            
            if (userId && token) {
                const apiBase = axiosInstance.defaults.baseURL || "";
                fetch(`${apiBase}/auth/presence`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ isActive }),
                    keepalive: true
                }).catch(() => {});
            }
        };

        const handleVisibilityChange = () => {
            updatePresence();
            if (document.visibilityState === "visible") {
                clearNotifications();
            }
        };

        const handleFocus = () => {
            updatePresence();
            clearNotifications();
        };

        const handleBlur = () => {
            updatePresence();
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleFocus);
        window.addEventListener("blur", handleBlur);
        
        // Initial state
        updatePresence();
        if (document.visibilityState === "visible") {
            clearNotifications();
        }

        const checkHealth = async () => {
            const timer = setTimeout(() => {
                setServerReady(true);
            }, 2500);

            if (!navigator.onLine) {
                clearTimeout(timer);
                setServerReady(true);
                return;
            }
            try {
                await axiosInstance.get("/messages/health");
                clearTimeout(timer);
                setServerReady(true);
            } catch (err) {
                if (!navigator.onLine) {
                    clearTimeout(timer);
                    setServerReady(true);
                } else {
                    // Retry health check but don't block the screen
                    setTimeout(async () => {
                        try {
                            await axiosInstance.get("/messages/health");
                        } catch (_) {}
                    }, 5000);
                }
            }
        };
        checkHealth();

        const prime = () => { primeAudioContext(); };
        window.addEventListener('touchstart', prime, { once: true });
        window.addEventListener('mousedown', prime, { once: true });

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("focus", handleFocus);
            window.removeEventListener("blur", handleBlur);
        };
    }, [token, userId]);

  return (
    <>
      <SplashScreen isReady={serverReady} />
      <NetworkBanner />
      <NetworkToast />
      <InstallPWA />
      <NotificationPrompt />
      <RecoveryKeyModal />

      {/* 1. Global Zen Waiting Overlay */}
      {zenWaitingState && (
        <div className="zen-modal-overlay">
          <div className="zen-modal-container" onClick={(e) => e.stopPropagation()}>
            {zenWaitingState === "invite-waiting" && (
              <>
                <div className="zen-waiting-loader">
                  <div className="zen-waiting-circle-bg" />
                  <div className="zen-waiting-circle-fg" />
                  <span className="zen-countdown-number">{zenCountdown}</span>
                </div>
                <h3 className="zen-modal-title">Connecting...</h3>
                <p className="zen-modal-desc">Waiting for peer to accept #ZenMode connection request.</p>
                <button 
                  className="zen-btn zen-btn-secondary" 
                  style={{ width: '100%' }} 
                  onClick={() => setShowCancelConfirm(true)}
                >
                  Cancel Request
                </button>
              </>
            )}
            {zenWaitingState === "exit-waiting" && (
              <>
                <div className="zen-waiting-loader">
                  <div className="zen-waiting-circle-bg" />
                  <div className="zen-waiting-circle-fg" />
                  <span className="zen-countdown-number">{zenCountdown}</span>
                </div>
                <h3 className="zen-modal-title">Requesting Exit...</h3>
                <p className="zen-modal-desc">Waiting for peer to approve ending the #ZenMode session.</p>
                <button 
                  className="zen-btn zen-btn-secondary" 
                  style={{ width: '100%' }} 
                  onClick={() => {
                    clearZenTimers();
                    setZenWaitingState(null);
                  }}
                >
                  Cancel
                </button>
              </>
            )}
            {zenWaitingState === "no-response" && (
              <>
                <div className="zen-waiting-loader" style={{ animation: 'none' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: 'auto' }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h3 className="zen-modal-title">No Response</h3>
                <p className="zen-modal-desc">User did not respond in time.</p>
              </>
            )}
            {zenWaitingState === "refused" && (
              <>
                <div className="zen-waiting-loader" style={{ animation: 'none' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: 'auto' }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <h3 className="zen-modal-title">Declined</h3>
                <p className="zen-modal-desc">Request was declined.</p>
              </>
            )}
            {zenWaitingState === "cancelled" && (
              <>
                <div className="zen-waiting-loader" style={{ animation: 'none' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: 'auto' }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h3 className="zen-modal-title">Cancelled</h3>
                <p className="zen-modal-desc">Connection request was cancelled.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. Custom Cancel Confirmation Prompt */}
      {showCancelConfirm && (
        <div className="zen-modal-overlay">
          <div className="zen-modal-container" onClick={(e) => e.stopPropagation()}>
            <h3 className="zen-modal-title">Cancel Zen Request?</h3>
            <p className="zen-modal-desc">Are you sure you want to cancel the connection request?</p>
            <div className="zen-modal-actions" style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button 
                className="zen-btn zen-btn-secondary" 
                style={{ flex: 1 }} 
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep Waiting
              </button>
              <button 
                className="zen-btn zen-btn-danger" 
                style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }} 
                onClick={() => {
                  clearZenTimers();
                  setZenWaitingState(null);
                  setShowCancelConfirm(false);
                  if (socket && activeChat) {
                    socket.emit("zen_invite_respond", { 
                      chatId: activeChat._id, 
                      responderId: user._id, 
                      requesterId: user._id, 
                      accepted: false 
                    });
                  }
                }}
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Global Incoming Zen Invite Overlay */}
      {incomingZenInvite && (
        <div className="zen-modal-overlay">
          <div className="zen-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="zen-waiting-loader">
              <div className="zen-waiting-circle-bg" />
              <div className="zen-waiting-circle-fg" />
              <span className="zen-countdown-number">{zenCountdown}</span>
            </div>
            <h3 className="zen-modal-title">#ZenMode Invite</h3>
            <p className="zen-modal-desc">@{incomingZenInvite.senderName || "User"} wants to connect in #ZenMode with you. Messages will be end-to-end encrypted and completely erased after session.</p>
            <div className="zen-modal-actions">
              <button className="zen-btn zen-btn-secondary" onClick={() => {
                clearZenTimers();
                if (socket) {
                  socket.emit("zen_invite_respond", { chatId: incomingZenInvite.chatId, responderId: user._id, requesterId: incomingZenInvite.senderId, accepted: false });
                }
                setIncomingZenInvite(null);
              }}>
                Ignore
              </button>
              <button className="zen-btn zen-btn-primary" onClick={async () => {
                clearZenTimers();
                
                // Priming B's audio
                try {
                  const audioCtx = getAudioContext();
                  if (audioCtx && audioCtx.state === "suspended") {
                    await audioCtx.resume();
                  }
                } catch (err) {}

                if (socket) {
                  socket.emit("zen_invite_respond", { chatId: incomingZenInvite.chatId, responderId: user._id, requesterId: incomingZenInvite.senderId, accepted: true });
                }

                // Programmatically find target chat in stores and open it
                const chatList = useChatStore.getState().chats;
                let target = chatList.find(c => c._id === incomingZenInvite.chatId);
                if (!target) {
                  await useChatStore.getState().fetchChats();
                  target = useChatStore.getState().chats.find(c => c._id === incomingZenInvite.chatId);
                }
                if (target) {
                  useChatStore.getState().setActiveChat(target);
                }

                setIncomingZenInvite(null);
              }}>
                Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Global Incoming Zen Exit Overlay */}
      {incomingZenExit && (
        <div className="zen-modal-overlay">
          <div className="zen-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="zen-waiting-loader">
              <div className="zen-waiting-circle-bg" />
              <div className="zen-waiting-circle-fg" />
              <span className="zen-countdown-number">{zenCountdown}</span>
            </div>
            <h3 className="zen-modal-title">End #ZenMode?</h3>
            <p className="zen-modal-desc">@{incomingZenExit.senderName || "User"} wants to end the #ZenMode session. All session messages will be permanently cleared from both devices.</p>
            <div className="zen-modal-actions">
              <button className="zen-btn zen-btn-secondary" onClick={() => {
                clearZenTimers();
                if (socket) {
                  socket.emit("zen_exit_respond", { chatId: incomingZenExit.chatId, responderId: user._id, requesterId: incomingZenExit.senderId, accepted: false });
                }
                setIncomingZenExit(null);
              }}>
                Stay
              </button>
              <button className="zen-btn zen-btn-primary" onClick={() => {
                clearZenTimers();
                if (socket) {
                  socket.emit("zen_exit_respond", { chatId: incomingZenExit.chatId, responderId: user._id, requesterId: incomingZenExit.senderId, accepted: true });
                }
                setIncomingZenExit(null);
              }}>
                Exit Convo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Custom Exit Confirmation Prompt */}
      {showExitConfirm && (
        <div className="zen-modal-overlay">
          <div className="zen-modal-container" onClick={(e) => e.stopPropagation()}>
            <h3 className="zen-modal-title">End Zen Session?</h3>
            <p className="zen-modal-desc">Are you sure you want to end this Zen session? All messages will be permanently cleared from both devices.</p>
            <div className="zen-modal-actions" style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button 
                className="zen-btn zen-btn-secondary" 
                style={{ flex: 1 }} 
                onClick={() => setShowExitConfirm(false)}
              >
                Keep Chatting
              </button>
              <button 
                className="zen-btn zen-btn-danger" 
                style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }} 
                onClick={() => {
                  setShowExitConfirm(false);
                  
                  // Find peer user ID
                  const currentUserId = user?._id;
                  const otherParticipant = activeChat?.participants?.find(p => (p._id || p) !== currentUserId);
                  const otherParticipantId = otherParticipant?._id || otherParticipant;

                  if (socket && activeChat && otherParticipantId) {
                    socket.emit("zen_exit_request", {
                      chatId: activeChat._id,
                      senderId: currentUserId,
                      receiverId: otherParticipantId
                    });
                    setZenWaitingState("exit-waiting");
                    startZenTimer("exit-waiting", activeChat._id, currentUserId, otherParticipantId);
                  }
                }}
              >
                Yes, End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Global Zen Toast Alerts */}
      {zenToast && (
        <div className={`zen-toast zen-toast-${zenToast.type}`}>
          {zenToast.type === 'success' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {zenToast.type === 'info' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          )}
          {zenToast.type === 'error' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
          <span>{zenToast.text}</span>
        </div>
      )}
      <Routes>
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestRoute>
              <ForgotPasswordPage />
            </GuestRoute>
          }
        />
        <Route
          path="/reset-password/:token"
          element={
            <GuestRoute>
              <ResetPasswordPage />
            </GuestRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;