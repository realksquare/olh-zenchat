import axios from "axios";

const DEFAULT_BACKEND_URL = "https://olh-zenchat.onrender.com";

const getBaseURL = () => {
    if (import.meta.env.VITE_API_URL) {
        return `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/api`;
    }
    if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        return `${DEFAULT_BACKEND_URL}/api`;
    }
    return "/api";
};

const baseURL = getBaseURL();

const appStartupTime = typeof window !== "undefined" ? Date.now() : 0;
const STARTUP_GRACE_PERIOD = 8000; // 8 seconds grace period for initial load/refresh

const axiosInstance = axios.create({
    baseURL: baseURL,
    headers: {
        "Content-Type": "application/json",
    },
});

axiosInstance.interceptors.request.use(
    (config) => {
        config.metadata = { startTime: new Date() };
        const token = localStorage.getItem("zenchat_token");
        const hasAuth = config.headers.Authorization || config.headers.authorization;
        if (token && !hasAuth) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
    (response) => {
        sessionStorage.removeItem("auth_401_failures");
        const startTime = response.config?.metadata?.startTime;
        if (startTime) {
            const duration = new Date() - startTime;
            const isStartupGracePeriod = (Date.now() - appStartupTime) < STARTUP_GRACE_PERIOD;
            if (duration > 2000 && !isStartupGracePeriod) {
                import("../stores/chatStore").then(module => {
                    module.useChatStore.getState().setLowBandwidth(true);
                });
            }
        }
        return response;
    },
    async (error) => {
        const startTime = error.config?.metadata?.startTime;
        if (startTime) {
            const duration = new Date() - startTime;
            const isStartupGracePeriod = (Date.now() - appStartupTime) < STARTUP_GRACE_PERIOD;
            if ((duration > 2000 || error.code === "ECONNABORTED") && !isStartupGracePeriod) {
                import("../stores/chatStore").then(module => {
                    module.useChatStore.getState().setLowBandwidth(true);
                });
            }
        }

        const config = error.config;
        if (config) {
            config.retryCount = config.retryCount || 0;
            const maxRetries = 3;
            const isIdempotent = ["get", "put", "delete", "head", "options"].includes(config.method?.toLowerCase());
            const shouldRetry = isIdempotent &&
                (!error.response || error.response.status >= 500 || error.response.status === 429) &&
                config.retryCount < maxRetries;

            if (shouldRetry) {
                config.retryCount += 1;
                const delay = 1000 * Math.pow(2, config.retryCount);
                console.warn(`Retrying request ${config.url} (Attempt ${config.retryCount}/${maxRetries}) in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return axiosInstance(config);
            }
        }

        const isAuthRoute = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register');
        
        if (error.response?.status === 401 && !isAuthRoute) {
            let failures = parseInt(sessionStorage.getItem("auth_401_failures") || "0");
            failures++;
            sessionStorage.setItem("auth_401_failures", failures.toString());
            
            if (failures >= 3) {
                localStorage.removeItem("zenchat_token");
                localStorage.removeItem("zenchat_user");
                localStorage.removeItem("zenchat-auth");
                sessionStorage.removeItem("auth_401_failures");
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;