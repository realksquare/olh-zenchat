import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

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
            if (duration > 2000) {
                import("../stores/chatStore").then(module => {
                    module.useChatStore.getState().setLowBandwidth(true);
                });
            }
        }
        return response;
    },
    (error) => {
        const startTime = error.config?.metadata?.startTime;
        if (startTime) {
            const duration = new Date() - startTime;
            if (duration > 2000 || error.code === "ECONNABORTED") {
                import("../stores/chatStore").then(module => {
                    module.useChatStore.getState().setLowBandwidth(true);
                });
            }
        }
        const isAuthRoute = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register');
        
        if (error.response?.status === 401 && !isAuthRoute) {
            localStorage.removeItem("zenchat_token");
            localStorage.removeItem("zenchat_user");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;