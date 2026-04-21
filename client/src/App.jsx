import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
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
  const [serverReady, setServerReady] = useState(false);

  useEffect(() => {
    checkAuth();
    // Health check to wake up Render and hide splash screen
    const checkHealth = async () => {
      try {
        await axiosInstance.get("/messages/health");
        setServerReady(true);
      } catch (err) {
        // Retry every 3 seconds if server is still sleeping
        setTimeout(checkHealth, 3000);
      }
    };
    checkHealth();

    // Prime AudioContext on first user interaction
    const prime = () => { primeAudioContext(); };
    window.addEventListener('touchstart', prime, { once: true });
    window.addEventListener('mousedown', prime, { once: true });

    // Handle FCM token registration (only if already granted)
    if (token && user) {
      const registerFCM = async () => {
        if (Notification.permission !== "granted") return;
        
        const fcmToken = await requestNotificationPermission();
        if (fcmToken) {
          try {
            const isPWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
            await axiosInstance.put("/auth/me", { 
              fcmToken,
              deviceType: isPWA ? "pwa" : "browser",
              notificationsEnabled: true // Enable by default if they grant permission
            });
            console.log("[FCM] Token registered successfully");
          } catch (err) {
            console.error("[FCM] Failed to register token with backend", err);
          }
        }
      };
      registerFCM();
    }

    return () => {};
  }, [token, user?._id]);

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