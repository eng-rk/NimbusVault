import axios from "axios";

const API_URL = "http://localhost:5000/api";

const api = axios.create({
    baseURL: API_URL,
});

// Automatically inject JWT token into authorization header
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Authentication Endpoints
export const registerUser = (data) => api.post("/auth/register", data);
export const loginUser = (data) => api.post("/auth/login", data);

// Files Endpoints
export const fetchFiles = (params) => api.get("/files", { params });
export const uploadFileApi = (formData, onUploadProgress) => {
    return api.post("/files/upload", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
        onUploadProgress,
    });
};
export const downloadFileApi = (id, password) => {
    return api.get(`/files/${id}/download`, {
        params: { password },
        responseType: "blob",
    });
};
export const renameFileApi = (id, originalName) => api.put(`/files/${id}/rename`, { originalName });
export const trashFileApi = (id) => api.delete(`/files/${id}`);
export const fetchTrashedFilesApi = () => api.get("/files/trash");
export const restoreFileApi = (id) => api.put(`/files/${id}/restore`);
export const permanentDeleteFileApi = (id) => api.delete(`/files/${id}/permanent`);
export const starFileApi = (id) => api.put(`/files/${id}/star`);
export const lockFileApi = (id, password) => api.put(`/files/${id}/lock`, { password });
export const shareFileApi = (id, userEmail, access) => api.post(`/files/${id}/share`, { userEmail, access });
export const createPublicLinkApi = (id) => api.post(`/files/${id}/public-link`);
export const fetchPublicFileApi = (token) => api.get(`/files/public/${token}`);

// Folders Endpoints
export const fetchFolders = () => api.get("/folders");
export const createFolderApi = (data) => api.post("/folders", data);
export const updateFolderApi = (id, data) => api.put(`/folders/${id}`, data);
export const deleteFolderApi = (id) => api.delete(`/folders/${id}`);
export const inviteToFolderApi = (id, userEmail, access) => api.post(`/folders/${id}/invite`, { userEmail, access });
export const generateFolderInviteLinkApi = (id) => api.post(`/folders/${id}/invite-link`);
export const fetchPublicFolderApi = (token) => api.get(`/folders/invite/${token}`);

// Activity log Endpoints
export const fetchActivitiesApi = () => api.get("/activity");

export default api;
