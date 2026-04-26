import { useEffect } from "react";
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
import { useState } from "react";
import { useSocket } from "./context/SocketContext";

const ProtectedRoute = ({ children }) => {
  const token = useAuthStore((state) => state.token);
  return token ? children : <Navigate to="/login" replace />;
};

const GuestRoute = ({ children }) => {
  const token = useAuthStore((state) => state.token);
  return !token ? children : <Navigate to="/" replace />;
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