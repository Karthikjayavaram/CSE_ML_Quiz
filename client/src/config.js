const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:5000`;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:5000`;

export default {
    API_BASE: `${API_BASE_URL}/api`,
    SOCKET_URL: SOCKET_URL
};
