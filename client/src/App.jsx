import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import { useChatStore } from "./stores/chatStore";
import { useMomentStore } from "./stores/momentStore";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import InstallPWA from "./components/ui/InstallPWA";
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
    const onOffline = () => { showBanner("offline"); };
    const onOnline = () => {
      setStatus(socket?.connected ? "online" : "reconnecting");
      if (socket?.connected) hideBanner();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      clearTimeout(hideTimer.current);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const onDisconnect = () => { showBanner("reconnecting"); };
    const onConnect = () => {
      showBanner("online");
      hideBanner();
    };
    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);
    return () => {
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
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

const App = () => {
  const { user, token, checkAuth } = useAuthStore();
  const { initLocalData, fetchChats } = useChatStore();
  const { socket } = useSocket();
  const [serverReady, setServerReady] = useState(false);

  useEffect(() => {
    if (token && user) {
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
  }, [token, user?._id]);

  useEffect(() => {
    checkAuth();
    if (token) {
      initLocalData();
      fetchChats();
      useMomentStore.getState().fetchMoments();
    }
    const checkHealth = async () => {
      try {
        await axiosInstance.get("/messages/health");
        setServerReady(true);
      } catch (err) {
        setTimeout(checkHealth, 2000);
      }
    };
    checkHealth();

    const prime = () => { primeAudioContext(); };
    window.addEventListener('touchstart', prime, { once: true });
    window.addEventListener('mousedown', prime, { once: true });

    return () => { };
  }, [token, user?._id, socket]);

  return (
    <>
      <SplashScreen isReady={serverReady} />
      <NetworkBanner />
      <InstallPWA />
      <NotificationPrompt />
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