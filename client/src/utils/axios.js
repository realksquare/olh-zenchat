import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

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
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
    (response) => {
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
            localStorage.removeItem("zenchat_token");
            localStorage.removeItem("zenchat_user");
            localStorage.removeItem("zenchat-auth");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;