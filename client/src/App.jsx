// ZenChat PWA Application Root
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import { useChatStore } from "./stores/chatStore";
import { useMomentStore } from "./stores/momentStore";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const ZenPulsePage = lazy(() => import("./pages/ZenPulsePage"));
import InstallPWA from "./components/ui/InstallPWA";
import RecoveryKeyModal from "./components/ui/RecoveryKeyModal";
import { primeAudioContext, getAudioContext } from "./utils/audio";
import { requestNotificationPermission } from "./utils/firebase";
import axiosInstance from "./utils/axios";
import NotificationPrompt from "./components/layout/NotificationPrompt";
import SplashScreen from "./components/ui/SplashScreen";
import PurgeNoticeModal from "./components/ui/PurgeNoticeModal";
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
  if (status !== "offline") return null;

  return (
    <div className="network-banner" data-status={status} onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
      <span style={{ flex: 1 }}>No connection</span>
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
    <div className={`zen-toast zen-toast-${toastIsLow ? 'info' : 'success'}`} style={{ pointerEvents: 'auto' }}>
      {toastIsLow ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#eab308', flexShrink: 0 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#10b981', flexShrink: 0 }}>
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
      <span>{toastMessage}</span>
      <button
        style={{ background: 'none', border: 'none', color: 'var(--color-text-muted, rgba(255, 255, 255, 0.5))', cursor: 'pointer', padding: '0 0 0 4px', display: 'flex', alignItems: 'center' }}
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
  const [showPwaExitConfirm, setShowPwaExitConfirm] = useState(false);
  const [showBlockedNotifModal, setShowBlockedNotifModal] = useState(false);

  const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  const isMobile = window.innerWidth <= 768;

  // OS-native prompt hooks for Mobile PWA
  useEffect(() => {
    if (!(isMobile && isPWA)) return;
    if (incomingZenInvite) {
      const confirmed = window.confirm(`@${incomingZenInvite.senderName || "User"} wants to connect in #ZenMode with you. Messages will be end-to-end encrypted and completely erased after session. Connect?`);
      if (confirmed) {
        clearZenTimers();
        if (socket) {
          socket.emit("zen_invite_respond", { chatId: incomingZenInvite.chatId, responderId: user._id, requesterId: incomingZenInvite.senderId, accepted: true });
        }
        const openChat = async () => {
          const chatList = useChatStore.getState().chats;
          let target = chatList.find(c => c._id === incomingZenInvite.chatId);
          if (!target) {
            await useChatStore.getState().fetchChats();
            target = useChatStore.getState().chats.find(c => c._id === incomingZenInvite.chatId);
          }
          if (target) {
            useChatStore.getState().setActiveChat(target);
          }
        };
        openChat();
      } else {
        clearZenTimers();
        if (socket) {
          socket.emit("zen_invite_respond", { chatId: incomingZenInvite.chatId, responderId: user._id, requesterId: incomingZenInvite.senderId, accepted: false });
        }
      }
      setIncomingZenInvite(null);
    }
  }, [incomingZenInvite, socket, user, isMobile, isPWA, clearZenTimers, setIncomingZenInvite]);

  useEffect(() => {
    if (!(isMobile && isPWA)) return;
    if (incomingZenExit) {
      const confirmed = window.confirm(`@${incomingZenExit.senderName || "User"} wants to end the #ZenMode session. All messages will be permanently cleared from both devices. End session?`);
      if (confirmed) {
        clearZenTimers();
        if (socket) {
          socket.emit("zen_exit_respond", { chatId: incomingZenExit.chatId, responderId: user._id, requesterId: incomingZenExit.senderId, accepted: true });
        }
      } else {
        clearZenTimers();
        if (socket) {
          socket.emit("zen_exit_respond", { chatId: incomingZenExit.chatId, responderId: user._id, requesterId: incomingZenExit.senderId, accepted: false });
        }
      }
      setIncomingZenExit(null);
    }
  }, [incomingZenExit, socket, user, isMobile, isPWA, clearZenTimers, setIncomingZenExit]);

  useEffect(() => {
    if (!(isMobile && isPWA)) return;
    if (showExitConfirm) {
      const confirmed = window.confirm("Are you sure you want to end this Zen session? All messages will be permanently cleared from both devices.");
      if (confirmed) {
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
      }
      setShowExitConfirm(false);
    }
  }, [showExitConfirm, socket, user, activeChat, isMobile, isPWA, setShowExitConfirm, setZenWaitingState, startZenTimer]);

  useEffect(() => {
    if (!(isMobile && isPWA)) return;
    if (showCancelConfirm) {
      const confirmed = window.confirm("Are you sure you want to cancel the connection request?");
      if (confirmed) {
        clearZenTimers();
        setZenWaitingState(null);
        if (socket && activeChat) {
          const otherParticipant = activeChat.participants?.find(p => {
            const pid = p?._id?.toString() || p?.toString();
            return pid && pid !== user?._id?.toString();
          });
          const otherParticipantId = otherParticipant?._id || otherParticipant;
          socket.emit("zen_invite_respond", { 
            chatId: activeChat._id, 
            responderId: user._id, 
            requesterId: user._id, 
            receiverId: otherParticipantId?.toString(),
            accepted: false 
          });
        }
      }
      setShowCancelConfirm(false);
    }
  }, [showCancelConfirm, socket, user, activeChat, isMobile, isPWA, clearZenTimers, setZenWaitingState]);

  useEffect(() => {
    const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (!isPWA) return;

    // Push a sentinel state so the first back-swipe fires popstate instead of leaving the app
    window.history.pushState({ pwaGuard: true }, "");

    const handlePopState = () => {
      // Allow proper exit if the flag is set
      if (window.__isExitingPWA) return;

      const momentStore = useMomentStore.getState();
      if (momentStore.activeViewerMoments) {
        momentStore.setActiveViewerMoments(null);
        window.history.pushState({ pwaGuard: true }, "");
        return;
      }

      // If we are in a chat (activeChat is set), going back should just close the chat
      const chatStore = useChatStore.getState();
      if (chatStore.activeChat) {
        chatStore.setActiveChat(null);
        // Push state again so the next back swipe can be intercepted
        window.history.pushState({ pwaGuard: true }, "");
        return;
      }

      // Only intercept when user is at the root route (trying to exit the PWA)
      if (window.location.pathname === "/" || window.location.pathname === "") {
        window.history.pushState({ pwaGuard: true }, "");
        setShowPwaExitConfirm(true);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (token) {
      const isNewSignup = sessionStorage.getItem("showFAQOnLoad") === "1";
      if (!isNewSignup) {
        const permission = typeof window.Notification !== 'undefined' ? window.Notification.permission : 'granted';
        if (permission === 'denied') {
          setShowBlockedNotifModal(true);
        } else {
          setShowBlockedNotifModal(false);
        }
      }
    } else {
      setShowBlockedNotifModal(false);
    }
  }, [token]);

  const handleSubscribePush = async () => {
    try {
      const fcmToken = await requestNotificationPermission();
      if (fcmToken) {
        const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
        const { data } = await axiosInstance.put("/auth/me", {
          fcmToken,
          deviceType: isPWA ? "pwa" : "browser",
          notificationsEnabled: true
        });
        if (data?.user) {
          useAuthStore.getState().updateUser(data.user);
          localStorage.setItem("zenchat_user", JSON.stringify(data.user));
        }
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to subscribe. Please try again or check browser settings.");
    }
  };

  const handleRecheckPermission = () => {
    const permission = typeof window.Notification !== 'undefined' ? window.Notification.permission : 'granted';
    if (permission === 'granted') {
      setShowBlockedNotifModal(false);
      handleSubscribePush();
    } else if (permission === 'default') {
      setShowBlockedNotifModal(false);
    }
    // If still denied, keep the modal open
  };

  const handleExitApp = () => {
    const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (isPWA) {
      window.close();
      setTimeout(() => {
        window.history.go(-(window.history.length + 1));
      }, 100);
    } else {
      window.location.href = "about:blank";
    }
  };

  useEffect(() => {
    if (user && token) {
      const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (user.timezone !== localTimezone) {
        useAuthStore.getState().syncTimezone(localTimezone);
      }
      if (user.selectedTheme && user.selectedTheme !== "default") {
        document.documentElement.setAttribute('data-theme', user.selectedTheme);
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [user, token]);


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

  // Listen for OPEN_CHAT from SW (notification quick-reply deep-link when app is running)
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === "OPEN_CHAT" && event.data.chatId) {
        window.dispatchEvent(new CustomEvent("sw-open-chat", { detail: { chatId: event.data.chatId } }));
      }
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handler);
    }
    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handler);
      }
    };
  }, []);

    useEffect(() => {
        const initialize = async () => {
            const currentToken = useAuthStore.getState().token;
            if (currentToken) {
                // 1. Instantly load local IDB cache to unblock splash screen
                await useChatStore.getState().initLocalData();
                setServerReady(true);
                
                // 2. Perform slow network requests in the background
                checkAuth().then(() => {
                    return Promise.all([
                        useChatStore.getState().fetchChats(),
                        useMomentStore.getState().fetchMoments()
                    ]);
                }).then(async () => {
                    // Decrypt previews once E2EE keys are fully cached/ready
                    try {
                        const { decryptMessageIfNeeded } = await import("./utils/e2eeHelper");
                        const chats = useChatStore.getState().chats;
                        let changed = false;
                        await Promise.all(chats.map(async (chat) => {
                            if (chat.lastMessage && chat.lastMessage.isEncrypted && !chat.lastMessage.decrypted) {
                                await decryptMessageIfNeeded(chat.lastMessage);
                                changed = true;
                            }
                        }));
                        if (changed) {
                            useChatStore.setState({ chats: [...chats] });
                        }
                    } catch (e2eeErr) {
                        console.error("Post-auth E2EE decryption failed:", e2eeErr);
                    }
                }).catch(console.error);
            } else {
                setServerReady(true);
                checkAuth().catch(console.error);
            }
        };
        initialize();

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

        const checkNotificationBlocked = () => {
            if (token) {
                const isNewSignup = sessionStorage.getItem("showFAQOnLoad") === "1";
                if (!isNewSignup) {
                    const permission = typeof window.Notification !== 'undefined' ? window.Notification.permission : 'granted';
                    if (permission === 'denied') {
                        setShowBlockedNotifModal(true);
                    } else {
                        setShowBlockedNotifModal(false);
                    }
                }
            }
        };

        const handleVisibilityChange = () => {
            updatePresence();
            if (document.visibilityState === "visible") {
                clearNotifications();
                checkNotificationBlocked();
            }
        };

        const handleFocus = () => {
            updatePresence();
            clearNotifications();
            checkNotificationBlocked();
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
      <PurgeNoticeModal />

      {/* 1. Global Zen Waiting Overlay */}
      {zenWaitingState && (() => {
        const otherParticipant = activeChat?.participants?.find(p => {
          const pid = p?._id?.toString() || p?.toString();
          return pid && pid !== userId?.toString();
        });
        const otherUserDisplayName = otherParticipant?.username || "the other user";
        return (
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
                  <p className="zen-modal-desc">Waiting for @{otherUserDisplayName} to accept #ZenMode connection request.</p>
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
                  <p className="zen-modal-desc">Waiting for @{otherUserDisplayName} to approve ending the #ZenMode session.</p>
                  <button 
                    className="zen-btn zen-btn-secondary" 
                    style={{ width: '100%' }} 
                    onClick={() => {
                      clearZenTimers();
                      setZenWaitingState("exit-cancelled");
                      setTimeout(() => setZenWaitingState(null), 3000);
                      if (socket && activeChat) {
                        const otherParticipant = activeChat.participants?.find(p => {
                          const pid = p?._id?.toString() || p?.toString();
                          return pid && pid !== user?._id?.toString();
                        });
                        const otherParticipantId = otherParticipant?._id || otherParticipant;
                        socket.emit("zen_exit_cancel", { receiverId: otherParticipantId?.toString() });
                      }
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
                  <p className="zen-modal-desc">@{otherUserDisplayName} didn't respond.</p>
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
                  <p className="zen-modal-desc">@{otherUserDisplayName} rejected the request to connect via #ZenMode.</p>
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
              {zenWaitingState === "exit-refused" && (
                <>
                  <div className="zen-waiting-loader" style={{ animation: 'none' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: 'auto' }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </div>
                  <h3 className="zen-modal-title">Declined</h3>
                  <p className="zen-modal-desc">@{otherUserDisplayName} refused to end the #ZenMode session.</p>
                </>
              )}
              {zenWaitingState === "exit-cancelled" && (
                <>
                  <div className="zen-waiting-loader" style={{ animation: 'none' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: 'auto' }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <h3 className="zen-modal-title">Cancelled</h3>
                  <p className="zen-modal-desc">Exit request was cancelled.</p>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* 2. Custom Cancel Confirmation Prompt */}
      {showCancelConfirm && !(isMobile && isPWA) && (
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
                style={{ flex: 1, background: '#ef4444', color: 'var(--color-text, #fff)', border: 'none', borderRadius: '8px', cursor: 'pointer' }} 
                onClick={() => {
                  clearZenTimers();
                  setZenWaitingState(null);
                  setShowCancelConfirm(false);
                  if (socket && activeChat) {
                    const otherParticipant = activeChat.participants?.find(p => {
                      const pid = p?._id?.toString() || p?.toString();
                      return pid && pid !== user?._id?.toString();
                    });
                    const otherParticipantId = otherParticipant?._id || otherParticipant;
                    socket.emit("zen_invite_respond", { 
                      chatId: activeChat._id, 
                      responderId: user._id, 
                      requesterId: user._id, 
                      receiverId: otherParticipantId?.toString(),
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
      {incomingZenInvite && !(isMobile && isPWA) && (
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
      {incomingZenExit && !(isMobile && isPWA) && (
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
      {showExitConfirm && !(isMobile && isPWA) && (
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
                style={{ flex: 1, background: '#ef4444', color: 'var(--color-text, #fff)', border: 'none', borderRadius: '8px', cursor: 'pointer' }} 
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
      <Suspense fallback={<SplashScreen isReady={false} />}>
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
          <Route path="/zenpulse" element={<ZenPulsePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* 2. PWA Exit Confirmation Overlay */}
      {showPwaExitConfirm && (
        <div className="mobile-bottom-sheet-overlay" style={{ zIndex: 99999999 }} onClick={() => setShowPwaExitConfirm(false)}>
          <div className="mobile-bottom-sheet exit-pwa-sheet" onClick={(e) => e.stopPropagation()} style={{ padding: "20px 0 32px" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#f8fafc", marginBottom: "8px", textAlign: "center", padding: "0 20px" }}>Exit ZenChat?</h3>
            <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "24px", lineHeight: "1.5", textAlign: "center", padding: "0 20px" }}>
              Are you sure you want to exit the application?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", padding: "0 20px", boxSizing: "border-box" }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowPwaExitConfirm(false);
                  window.__isExitingPWA = true;
                  // For standalone PWA: window.close() closes the PWA window on Android/Chrome
                  window.close();
                  // Fallback: if close didn't work (some browsers), navigate back to exit
                  setTimeout(() => {
                    try {
                      window.history.back();
                      setTimeout(() => {
                        if (window.history.length > 1) window.history.back();
                      }, 100);
                    } catch (_) {}
                  }, 300);
                }}
                style={{ width: "100%", padding: "12px", borderRadius: "12px", background: "#ef4444", border: "none", color: "var(--color-text, #fff)", cursor: "pointer", fontWeight: "600", fontSize: "0.95rem" }}
              >
                Exit App
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowPwaExitConfirm(false)}
                style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", background: "transparent", color: "#cbd5e1", cursor: "pointer", fontSize: "0.95rem" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 4. Notifications Blocked Modal */}
      {showBlockedNotifModal && (
        <div className="compulsory-push-overlay" style={{ alignItems: window.innerWidth <= 768 ? 'flex-end' : 'center', padding: window.innerWidth <= 768 ? 0 : '24px' }}>
          <div
            className="compulsory-push-card"
            style={{
              maxWidth: window.innerWidth <= 768 ? '100%' : '420px',
              borderRadius: window.innerWidth <= 768 ? '24px 24px 0 0' : '24px',
              padding: window.innerWidth <= 768 ? '28px 24px 40px' : '32px',
              animation: window.innerWidth <= 768 ? 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)' : 'compulsoryCardScale 0.4s cubic-bezier(0.34,1.56,0.64,1)'
            }}
          >
            <div className="compulsory-push-icon-pulse" style={{ background: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="compulsory-push-title">Notifications Blocked</h2>
            <p className="compulsory-push-desc">
              ZenChat requires push notifications for real-time message delivery. Your browser has blocked notifications for this site.
            </p>
            <div className="compulsory-push-warning" style={{ textAlign: 'left', marginBottom: '20px' }}>
              <strong style={{ display: 'block', marginBottom: '6px', color: '#fca5a5' }}>How to unblock:</strong>
              <span style={{ fontSize: '0.82rem', lineHeight: '1.7', color: '#fca5a5' }}>
                Tap the lock icon or info icon in your browser address bar, find &quot;Notifications&quot;, and set it to &quot;Allow&quot;. Then tap the button below.
              </span>
            </div>
            <div className="compulsory-push-buttons">
              <button
                className="btn btn-primary compulsory-push-btn"
                onClick={handleRecheckPermission}
                style={{ background: 'var(--color-primary)' }}
              >
                I have unblocked it - Continue
              </button>
              <button className="btn btn-outline compulsory-push-exit-btn" onClick={handleExitApp}>
                Exit Site / PWA
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;