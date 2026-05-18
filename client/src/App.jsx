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
import { primeAudioContext } from "./utils/audio";
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
  const { socket } = useSocket();
  const [status, setStatus] = useState("online");
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);

  const showBanner = (s) => {
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
      if (!navigator.onLine) {
        showBanner("offline");
      } else if (socket && !socket.connected) {
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
      handleStatusChange(); // Initial check
    }

    return () => {
      window.removeEventListener("offline", handleStatusChange);
      window.removeEventListener("online", handleStatusChange);
      if (socket) {
        socket.off("disconnect", handleStatusChange);
        socket.off("connect", handleStatusChange);
      }
      clearTimeout(hideTimer.current);
    };
  }, [socket]);

  if (!visible || status === "online") return null;

  return (
    <div className="network-banner" data-status={status}>
      {status === "offline" ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
          No connection
        </>
      ) : (
        <>
          <span className="banner-spinner" />
          Reconnecting
        </>
      )}
    </div>
  );
};

const NetworkToast = () => {
  const isLowBandwidth = useChatStore((s) => s.isLowBandwidth);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const prevLowBandwidth = useRef(isLowBandwidth);
  const timer = useRef(null);

  useEffect(() => {
    if (prevLowBandwidth.current !== isLowBandwidth) {
      clearTimeout(timer.current);
      if (isLowBandwidth) {
        setToastMessage("SmartPayload-OPtimization (SP-OP): Active (Low connection detected)");
      } else {
        setToastMessage("Connection restored. Returning to standard operational mode.");
      }
      setToastVisible(true);
      timer.current = setTimeout(() => setToastVisible(false), 5000);
      prevLowBandwidth.current = isLowBandwidth;
    }
  }, [isLowBandwidth]);

  if (!toastVisible) return null;

  return (
    <div className="aura-toast" style={{
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99999,
      background: 'rgba(15, 23, 42, 0.9)',
      backdropFilter: 'blur(8px)',
      border: isLowBandwidth ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
      color: isLowBandwidth ? '#fef08a' : '#a7f3d0',
      padding: '10px 18px',
      borderRadius: '24px',
      fontSize: '0.82rem',
      fontWeight: '600',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      animation: 'toast-slide-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    }}>
      {isLowBandwidth ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#eab308' }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#10b981' }}>
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
      <span>{toastMessage}</span>
    </div>
  );
};

const App = () => {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?._id);
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const { socket } = useSocket();
  const [serverReady, setServerReady] = useState(false);

  useEffect(() => {
    if (token && userId) {
      const registerFCM = async () => {
        try {
          if (Notification.permission !== "granted") return;
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

        const handleVisibilityChange = () => {
            if (socket && socket.connected) {
                socket.emit("set_active_status", { isActive: document.visibilityState === "visible" });
            }
            if (document.visibilityState === "visible") {
                clearNotifications();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        
        // Initial state
        if (socket && socket.connected) {
            socket.emit("set_active_status", { isActive: document.visibilityState === "visible" });
        }
        if (document.visibilityState === "visible") {
            clearNotifications();
        }

        const checkHealth = async () => {
            if (!navigator.onLine) {
                setServerReady(true);
                return;
            }
            try {
                await axiosInstance.get("/messages/health");
                setServerReady(true);
            } catch (err) {
                if (!navigator.onLine) {
                    setServerReady(true);
                } else {
                    setTimeout(checkHealth, 5000);
                }
            }
        };
        checkHealth();

        const prime = () => { primeAudioContext(); };
        window.addEventListener('touchstart', prime, { once: true });
        window.addEventListener('mousedown', prime, { once: true });

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
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