import React, { useEffect, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import {
  Cloud,
  Folder as FolderIcon,
  File as FileIcon,
  Upload,
  Download,
  Trash2,
  Search,
  LogOut,
  Plus,
  Share2,
  Pencil,
  Star,
  Info,
  LayoutGrid,
  List,
  Lock,
  Unlock,
  ShieldAlert,
  Eye,
  Calendar,
  Clock,
  BarChart3,
  Bell,
  CheckCircle,
  AlertCircle,
  X,
  ChevronRight,
  Moon,
  Sun,
  ArrowLeft,
  RefreshCcw,
  FolderOpen
} from "lucide-react";
import "./styles.css";
import {
  registerUser,
  loginUser,
  fetchFiles,
  uploadFileApi,
  downloadFileApi,
  renameFileApi,
  trashFileApi,
  fetchTrashedFilesApi,
  restoreFileApi,
  permanentDeleteFileApi,
  starFileApi,
  lockFileApi,
  shareFileApi,
  createPublicLinkApi,
  fetchPublicFileApi,
  fetchFolders,
  createFolderApi,
  updateFolderApi,
  deleteFolderApi,
  inviteToFolderApi,
  generateFolderInviteLinkApi,
  fetchPublicFolderApi,
  fetchActivitiesApi
} from "./api";

const STORAGE_LIMIT = 15 * 1024 * 1024 * 1024; // 15 GB
const CATEGORY_COLORS = {
  pdf: "rgb(239, 68, 68)",
  image: "rgb(139, 92, 246)",
  video: "rgb(6, 182, 212)",
  audio: "rgb(236, 72, 153)",
  word: "rgb(59, 130, 246)",
  excel: "rgb(16, 185, 129)",
  powerpoint: "rgb(249, 115, 22)",
  other: "rgb(100, 116, 139)"
};

function formatSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}

/* ─── MAIN APP ROUTER ─── */
function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [toasts, setToasts] = useState([]);
  const socketRef = useRef(null);

  // Apply visual theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light-mode");
    } else {
      root.classList.remove("light-mode");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Handle Toast notification push
  const triggerToast = (msg, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Socket.io Listener Configuration
  useEffect(() => {
    if (user) {
      const socket = io("http://localhost:5000");
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("join", user.id);
      });

      socket.on("notification", (data) => {
        triggerToast(data.msg, data.type === "error" ? "error" : "success");
        // Dispatch custom event to tell dashboard to update files/folders/activities list
        window.dispatchEvent(new CustomEvent("nimbus-reload"));
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [user]);

  // Catch OAuth callback tokens in URL
  useEffect(() => {
    if (currentPath === "/oauth-callback") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (token) {
        localStorage.setItem("token", token);
        // Decode simple payload or fetch user info. We can store token first, 
        // and get user profile or construct placeholder.
        const payload = JSON.parse(atob(token.split(".")[1]));
        const userObj = {
          id: payload.id,
          userName: payload.userName || "Google User",
          email: payload.email,
          role: payload.role || "user",
          storageUsed: 0
        };
        localStorage.setItem("user", JSON.stringify(userObj));
        setUser(userObj);
        triggerToast("Welcome with Google OAuth!", "success");
      }
      window.history.replaceState({}, document.title, "/");
      setCurrentPath("/");
    }
  }, [currentPath]);

  const logout = () => {
    localStorage.clear();
    setUser(null);
    triggerToast("Logged out successfully");
  };

  // Check if viewing a public folder link
  if (currentPath.startsWith("/invite-folder/")) {
    const token = currentPath.split("/invite-folder/")[1];
    return <PublicFolderView token={token} theme={theme} setTheme={setTheme} />;
  }

  return (
    <>
      {/* Toast Alert overlay */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast" style={{ borderLeftColor: t.type === "error" ? "var(--danger)" : "var(--secondary)" }}>
            {t.type === "error" ? <AlertCircle size={18} color="var(--danger)" /> : <CheckCircle size={18} color="var(--success)" />}
            <span style={{ fontSize: "13px" }}>{t.msg}</span>
            <button onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {user ? (
        <Dashboard user={user} logout={logout} theme={theme} setTheme={setTheme} triggerToast={triggerToast} />
      ) : (
        <Auth onAuth={(userData) => {
          setUser(userData);
          triggerToast(`Welcome back, ${userData.userName}!`, "success");
        }} triggerToast={triggerToast} />
      )}
    </>
  );
}

/* ─── AUTHENTICATION SCREEN ─── */
function Auth({ onAuth, triggerToast }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ userName: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "register") {
        await registerUser(form);
        triggerToast("Account created! Please log in.", "success");
        setMode("login");
        setForm({ userName: "", email: "", password: "" });
      } else {
        const { data } = await loginUser({ email: form.email, password: form.password });
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.data));
        onAuth(data.data);
      }
    } catch (error) {
      console.error(error);
      triggerToast(error.response?.data?.msg || "Authentication error", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleOAuth = () => {
    window.location.href = "http://localhost:5000/api/auth/google";
  };

  return (
    <main className="auth-page">
      <section className="auth-card" id="auth-form-card">
        <div className="brand-wrapper">
          <div className="logo-icon">
            <Cloud size={28} />
          </div>
          <span className="brand-text">NimbusVault</span>
        </div>

        <p style={{ textAlign: "center", fontSize: "14px", color: "var(--text-muted)", marginBottom: "24px" }}>
          Secure, intelligent cloud storage.
        </p>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
            id="login-tab-btn"
          >
            Log In
          </button>
          <button
            className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
            id="register-tab-btn"
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="input-group">
              <label className="input-label" htmlFor="register-username">Username</label>
              <input
                id="register-username"
                className="input-field"
                placeholder="Your name"
                value={form.userName}
                onChange={(e) => setForm({ ...form, userName: e.target.value })}
                required
              />
            </div>
          )}

          <div className="input-group">
            <label className="input-label" htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              type="email"
              className="input-field"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button className="btn-primary" type="submit" disabled={loading} id="auth-submit-btn">
            {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>

        <div className="divider">OR</div>

        <button className="btn-secondary" onClick={handleGoogleOAuth} id="google-auth-btn">
          <svg style={{ width: "18px", height: "18px" }} viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.57 15.02 1 12 1 7.24 1 3.2 3.73 1.24 7.72l3.83 2.97C6.01 7.29 8.78 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-1.99 3.41-4.92 3.41-8.6z"
            />
            <path
              fill="#FBBC05"
              d="M5.07 14.69c-.24-.72-.38-1.49-.38-2.3s.14-1.58.38-2.3L1.24 7.12C.45 8.73 0 10.52 0 12.39s.45 3.66 1.24 5.27l3.83-2.97z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.03.69-2.34 1.1-3.96 1.1-3.22 0-5.99-2.25-6.93-5.65l-3.83 2.97C3.2 20.27 7.24 23 12 23z"
            />
          </svg>
          Continue with Google
        </button>
      </section>
    </main>
  );
}

/* ─── MAIN DASHBOARD ─── */
function Dashboard({ user, logout, theme, setTheme, triggerToast }) {
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activeTab, setActiveTab] = useState("drive"); // drive, recent, starred, insights, activity, trash
  const [currentFolder, setCurrentFolder] = useState(null); // folder object or null for root
  const [layoutMode, setLayoutMode] = useState("grid"); // grid or list
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Multi-upload progress tray state
  const [uploadList, setUploadList] = useState([]); // { id, name, progress }

  // Modals & Panels state
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderForm, setFolderForm] = useState({ id: null, name: "", color: "blue", icon: "folder" });
  
  const [selectedFile, setSelectedFile] = useState(null); // for detail panel
  const [previewFile, setPreviewFile] = useState(null); // for full screen media preview

  // Shared folder charging setting
  const [chargeToOwner, setChargeToOwner] = useState(true);

  // File share modals
  const [shareFileItem, setShareFileItem] = useState(null);
  const [shareForm, setShareForm] = useState({ email: "", access: "view" });
  const [sharePublicLink, setSharePublicLink] = useState(null);

  // Lock file modal
  const [lockFileItem, setLockFileItem] = useState(null);
  const [lockPassword, setLockPassword] = useState("");

  // Download password lock prompt
  const [pendingDownloadFile, setPendingDownloadFile] = useState(null);
  const [downloadPassword, setDownloadPassword] = useState("");

  // Folder share/invite modal
  const [shareFolderItem, setShareFolderItem] = useState(null);
  const [folderInviteForm, setFolderInviteForm] = useState({ email: "", access: "view" });
  const [folderInviteLink, setFolderInviteLink] = useState(null);

  // Fetch core data from backend
  const loadData = async () => {
    try {
      const folderRes = await fetchFolders();
      setFolders(folderRes.data.data);

      const params = {
        search: searchQuery || undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        folderId: activeTab === "drive" && currentFolder ? currentFolder._id : undefined,
        isStarred: activeTab === "starred" ? "true" : undefined,
        isTrashed: activeTab === "trash" ? "true" : "false"
      };

      const fileRes = await fetchFiles(params);
      setFiles(fileRes.data.data);

      const activityRes = await fetchActivitiesApi();
      setActivities(activityRes.data.data);
    } catch (error) {
      console.error(error);
      triggerToast("Error retrieving Vault data", "error");
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, currentFolder, searchQuery, categoryFilter]);

  // Handle reload triggered via WebSocket notification
  useEffect(() => {
    const handleReload = () => loadData();
    window.addEventListener("nimbus-reload", handleReload);
    return () => window.removeEventListener("nimbus-reload", handleReload);
  }, [activeTab, currentFolder, searchQuery, categoryFilter]);

  // Compute storage used locally based on files
  const currentStorageUsed = useMemo(() => {
    // Return storageUsed computed by backend (on user object) or sum of files
    // Let's summarize owned non-trashed files size
    return files.filter(f => f.ownerId === user.id && !f.isTrashed).reduce((sum, f) => sum + f.size, 0);
  }, [files, user]);

  // ─── FOLDER CRUD HANDLERS ───
  const handleSaveFolder = async (e) => {
    e.preventDefault();
    if (!folderForm.name.trim()) return;

    try {
      if (folderForm.id) {
        await updateFolderApi(folderForm.id, {
          name: folderForm.name,
          color: folderForm.color,
          icon: folderForm.icon
        });
        triggerToast("Folder modified successfully", "success");
      } else {
        await createFolderApi({
          name: folderForm.name,
          color: folderForm.color,
          icon: folderForm.icon
        });
        triggerToast("Folder initialized", "success");
      }
      setShowFolderModal(false);
      setFolderForm({ id: null, name: "", color: "blue", icon: "folder" });
      loadData();
    } catch (error) {
      triggerToast(error.response?.data?.msg || "Folder action failed", "error");
    }
  };

  const handleEditFolderClick = (folder) => {
    setFolderForm({
      id: folder._id,
      name: folder.name,
      color: folder.color,
      icon: folder.icon
    });
    setShowFolderModal(true);
  };

  const handleDeleteFolder = async (folder) => {
    if (!confirm(`Trash folder "${folder.name}" and all files inside?`)) return;
    try {
      await deleteFolderApi(folder._id);
      triggerToast("Folder relocated to Trash bin");
      if (currentFolder?._id === folder._id) {
        setCurrentFolder(null);
      }
      loadData();
    } catch (error) {
      triggerToast("Error removing folder", "error");
    }
  };

  // ─── FILE HANDLERS ───
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check size first locally
    if (file.size > 500 * 1024 * 1024) {
      triggerToast("File exceeds maximum 500MB upload limit", "error");
      return;
    }

    const uploadId = Date.now() + "-" + Math.random();
    setUploadList((prev) => [...prev, { id: uploadId, name: file.name, progress: 0 }]);

    const formData = new FormData();
    formData.append("file", file);
    if (currentFolder) {
      formData.append("folderId", currentFolder._id);
    }
    formData.append("chargeToOwner", currentFolder ? chargeToOwner.toString() : "true");

    try {
      await uploadFileApi(formData, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadList((prev) =>
          prev.map((item) => (item.id === uploadId ? { ...item, progress: percent } : item))
        );
      });
      triggerToast(`${file.name} securely uploaded!`, "success");
      loadData();
    } catch (error) {
      triggerToast(error.response?.data?.msg || "File encryption or upload failed", "error");
    } finally {
      // Clear from tray after 2 seconds
      setTimeout(() => {
        setUploadList((prev) => prev.filter((item) => item.id !== uploadId));
      }, 2000);
      e.target.value = "";
    }
  };

  const handleDownload = async (file, password = "") => {
    try {
      const response = await downloadFileApi(file._id, password);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setPendingDownloadFile(null);
      setDownloadPassword("");
    } catch (error) {
      // If locked, prompt
      if (error.response?.status === 403) {
        setPendingDownloadFile(file);
        if (password) {
          triggerToast("Incorrect lock password key", "error");
        } else {
          triggerToast("Security password verification required", "warning");
        }
      } else {
        triggerToast("Download authentication failed", "error");
      }
    }
  };

  const handleRenameFile = async (file) => {
    const newName = prompt("Enter new filename key:", file.originalName);
    if (!newName || newName === file.originalName) return;

    try {
      await renameFileApi(file._id, newName);
      triggerToast("Resource name revised", "success");
      loadData();
    } catch (error) {
      triggerToast("Failed to rename file", "error");
    }
  };

  const handleTrashFile = async (file) => {
    try {
      await trashFileApi(file._id);
      triggerToast("File moved to Trash");
      setSelectedFile(null);
      loadData();
    } catch (error) {
      triggerToast("Error trashing file", "error");
    }
  };

  const handleStarFile = async (file) => {
    try {
      await starFileApi(file._id);
      triggerToast(file.isStarred ? "Removed favorites tag" : "Added favorites tag", "success");
      loadData();
    } catch (error) {
      triggerToast("Action starred error", "error");
    }
  };

  // Lock File Handler
  const handleLockFile = async (e) => {
    e.preventDefault();
    try {
      await lockFileApi(lockFileItem._id, lockPassword);
      triggerToast(lockPassword ? "Vault security padlock engaged" : "Padlock disengaged", "success");
      setLockFileItem(null);
      setLockPassword("");
      loadData();
    } catch (error) {
      triggerToast("Lock configuration failed", "error");
    }
  };

  // Share File Handler
  const handleShareFile = async (e) => {
    e.preventDefault();
    if (!shareForm.email.trim()) return;

    try {
      await shareFileApi(shareFileItem._id, shareForm.email, shareForm.access);
      triggerToast(`Shared with ${shareForm.email} successfully`, "success");
      setShareForm({ email: "", access: "view" });
      loadData();
    } catch (error) {
      triggerToast("Email share error", "error");
    }
  };

  const handleGeneratePublicLink = async (file) => {
    try {
      const { data } = await createPublicLinkApi(file._id);
      const shareUrl = `${window.location.origin}/api/files/public/${data.token}`;
      setSharePublicLink(shareUrl);
      triggerToast("Public link activated", "success");
      loadData();
    } catch (error) {
      triggerToast("Link activation failure", "error");
    }
  };

  // ─── TRASH DISPOSAL ───
  const handleRestoreFile = async (file) => {
    try {
      await restoreFileApi(file._id);
      triggerToast("Vault resource restored", "success");
      loadData();
    } catch (error) {
      triggerToast("Restoration fault", "error");
    }
  };

  const handlePermanentDelete = async (file) => {
    if (!confirm(`Permanently purge "${file.originalName}"? There is no recovery.`)) return;
    try {
      await permanentDeleteFileApi(file._id);
      triggerToast("Data wiped from servers", "warning");
      loadData();
    } catch (error) {
      triggerToast("Deletion failure", "error");
    }
  };

  // ─── FOLDER SHARING ───
  const handleShareFolder = async (e) => {
    e.preventDefault();
    if (!folderInviteForm.email.trim()) return;

    try {
      await inviteToFolderApi(shareFolderItem._id, folderInviteForm.email, folderInviteForm.access);
      triggerToast(`Folder shared with ${folderInviteForm.email}`, "success");
      setFolderInviteForm({ email: "", access: "view" });
      loadData();
    } catch (error) {
      triggerToast("Folder invitation failed", "error");
    }
  };

  const handleGenerateFolderInviteLink = async (folder) => {
    try {
      const { data } = await generateFolderInviteLinkApi(folder._id);
      const inviteUrl = `${window.location.origin}/invite-folder/${data.token}`;
      setFolderInviteLink(inviteUrl);
      triggerToast("Invite link created", "success");
      loadData();
    } catch (error) {
      triggerToast("Invite link generation error", "error");
    }
  };

  // ─── ANALYTICS CHART CALCULATIONS ───
  const storageSummaryStats = useMemo(() => {
    const stats = {
      pdf: 0,
      image: 0,
      video: 0,
      audio: 0,
      word: 0,
      excel: 0,
      powerpoint: 0,
      other: 0
    };
    files.forEach(f => {
      if (!f.isTrashed && stats[f.category] !== undefined) {
        stats[f.category] += f.size;
      }
    });

    // Make conic gradient CSS segments
    const total = Object.values(stats).reduce((sum, v) => sum + v, 0);
    let cumulativePercent = 0;
    const segments = [];
    
    Object.entries(stats).forEach(([cat, size]) => {
      if (size > 0 && total > 0) {
        const percent = (size / total) * 100;
        const color = CATEGORY_COLORS[cat];
        segments.push(`${color} ${cumulativePercent}% ${cumulativePercent + percent}%`);
        cumulativePercent += percent;
      }
    });

    const styleGradient = segments.length > 0
      ? `conic-gradient(${segments.join(", ")})`
      : `conic-gradient(var(--border) 0% 100%)`;

    return { stats, styleGradient, total };
  }, [files]);

  // Get Top 5 largest files
  const topFiveFiles = useMemo(() => {
    return [...files]
      .filter(f => !f.isTrashed)
      .sort((a, b) => b.size - a.size)
      .slice(0, 5);
  }, [files]);

  return (
    <div className="app-shell">
      {/* DESKTOP SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo-icon" style={{ padding: "8px" }}>
            <Cloud size={22} />
          </div>
          <span className="brand-text" style={{ fontSize: "20px" }}>NimbusVault</span>
        </div>

        <nav className="sidebar-menu">
          <button className={`menu-item ${activeTab === "drive" ? "active" : ""}`} onClick={() => { setActiveTab("drive"); setCurrentFolder(null); }}>
            <Cloud size={18} />
            My Drive
          </button>
          <button className={`menu-item ${activeTab === "starred" ? "active" : ""}`} onClick={() => setActiveTab("starred")}>
            <Star size={18} />
            Favorites
          </button>
          <button className={`menu-item ${activeTab === "insights" ? "active" : ""}`} onClick={() => setActiveTab("insights")}>
            <BarChart3 size={18} />
            Insight Analytics
          </button>
          <button className={`menu-item ${activeTab === "activity" ? "active" : ""}`} onClick={() => setActiveTab("activity")}>
            <Clock size={18} />
            Activity log
          </button>
          <button className={`menu-item ${activeTab === "trash" ? "active" : ""}`} onClick={() => setActiveTab("trash")}>
            <Trash2 size={18} />
            Trash bin
          </button>
        </nav>

        {/* STORAGE BAR */}
        <div className="sidebar-storage">
          <div className="storage-header">
            <span>Occupied Space</span>
            <span>{Math.round((currentStorageUsed / STORAGE_LIMIT) * 100)}%</span>
          </div>
          <div className="storage-bar">
            <div className="storage-bar-progress" style={{ width: `${Math.min(100, (currentStorageUsed / STORAGE_LIMIT) * 100)}%` }}></div>
          </div>
          <span className="storage-meta">{formatSize(currentStorageUsed)} / 15.0 GB</span>
        </div>

        <button className="logout-btn" onClick={logout} id="sidebar-logout-btn">
          <LogOut size={18} />
          Log Out
        </button>
      </aside>

      {/* MAIN LAYOUT */}
      <main className="main-content">
        <header className="top-bar">
          <div>
            <h1 style={{ fontSize: "28px" }}>
              {activeTab === "drive" && (currentFolder ? currentFolder.name : "My Drive")}
              {activeTab === "starred" && "Starred"}
              {activeTab === "insights" && "Storage Insight"}
              {activeTab === "activity" && "Activity"}
              {activeTab === "trash" && "Trash"}
            </h1>
          </div>

          <div className="top-bar-actions">
            {/* Search Input */}
            <div className="search-container">
              <Search size={18} color="var(--text-muted)" />
              <input
                className="search-input"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Dark/Light mode toggle */}
            <button className="theme-toggle-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Upload Button */}
            {activeTab === "drive" && (
              <div className="upload-button-wrapper">
                <button className="btn-upload">
                  <Upload size={18} />
                  Upload
                </button>
                <input type="file" className="upload-input" onChange={handleUpload} id="nimbus-file-injector" />
              </div>
            )}
          </div>
        </header>

        {/* Shared storage deduction flag banner */}
        {activeTab === "drive" && currentFolder && currentFolder.ownerId !== user.id && (
          <div style={{ background: "rgba(108, 99, 255, 0.08)", padding: "12px 20px", borderRadius: "10px", border: "1px solid rgba(108, 99, 255, 0.2)", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px" }}>
              💡 Shared Folder Storage charging context: <strong>{currentFolder.name}</strong> is owned by another user.
            </span>
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={chargeToOwner}
                onChange={(e) => setChargeToOwner(e.target.checked)}
              />
              Charge owner storage
            </label>
          </div>
        )}

        {/* ─── DRIVE CONTENT TAB ─── */}
        {activeTab === "drive" && (
          <>
            {/* Breadcrumbs */}
            <div className="breadcrumb-container">
              <span className="breadcrumb-item" onClick={() => setCurrentFolder(null)}>Root Vault</span>
              {currentFolder && (
                <>
                  <ChevronRight size={14} />
                  <span className="breadcrumb-item">{currentFolder.name}</span>
                </>
              )}
            </div>

            {/* Filter Chips */}
            <div className="filter-container">
              {["all", "pdf", "image", "video", "audio", "word", "excel", "powerpoint"].map((cat) => (
                <button
                  key={cat}
                  className={`filter-chip ${categoryFilter === cat ? "active" : ""}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Section Controls */}
            <div className="section-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <h3 style={{ fontSize: "16px", color: "var(--text-main)" }}>Subdirectories</h3>
                <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => { setFolderForm({ id: null, name: "", color: "blue", icon: "folder" }); setShowFolderModal(true); }}>
                  <Plus size={14} /> Add Folder
                </button>
              </div>

              <div className="toggle-layout-container">
                <button className={`layout-btn ${layoutMode === "grid" ? "active" : ""}`} onClick={() => setLayoutMode("grid")}>
                  <LayoutGrid size={16} />
                </button>
                <button className={`layout-btn ${layoutMode === "list" ? "active" : ""}`} onClick={() => setLayoutMode("list")}>
                  <List size={16} />
                </button>
              </div>
            </div>

            {/* Folders grid */}
            {!currentFolder && folders.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>No custom vaults mapped.</p>
            )}
            {!currentFolder && folders.length > 0 && (
              <div className="folders-grid">
                {folders.map((folder) => (
                  <div key={folder._id} className={`folder-card folder-color-${folder.color}`}>
                    <div className="folder-icon-wrapper">
                      <FolderIcon size={24} />
                    </div>
                    <div className="folder-info" style={{ cursor: "pointer" }} onClick={() => setCurrentFolder(folder)}>
                      <h4 className="folder-name">{folder.name}</h4>
                      <span className="folder-meta">{folder.sharedWith?.length > 0 ? "Shared" : "Private"}</span>
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button className="file-action-icon-btn" onClick={() => handleEditFolderClick(folder)}>
                        <Pencil size={14} />
                      </button>
                      <button className="file-action-icon-btn" onClick={() => setShareFolderItem(folder)}>
                        <Share2 size={14} />
                      </button>
                      <button className="file-action-icon-btn" style={{ color: "var(--danger)" }} onClick={() => handleDeleteFolder(folder)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Files view grid/list */}
            <div className="section-header" style={{ marginTop: "16px" }}>
              <h3 style={{ fontSize: "16px", color: "var(--text-main)" }}>Secure Items</h3>
            </div>

            {files.length === 0 ? (
              <div className="empty-illustration">
                <Cloud size={64} style={{ opacity: 0.15 }} />
                <h3>No Encrypted Items</h3>
                <p>Upload files or drag here to engage security storage</p>
              </div>
            ) : (
              <>
                {layoutMode === "grid" ? (
                  <div className="files-layout-grid">
                    {files.map((file) => (
                      <div key={file._id} className={`file-card-v2 category-${file.category}`}>
                        <div className="file-preview-thumbnail" style={{ cursor: "pointer" }} onClick={() => setPreviewFile(file)}>
                          {file.category === "image" ? (
                            <img src={`http://localhost:5000/uploads/${file.storedName}`} className="file-preview-img" alt={file.originalName} />
                          ) : (
                            <FileIcon size={36} color={`var(--cat-clr)`} />
                          )}
                          <span className="category-badge">{file.category}</span>
                          <button className={`card-star-btn ${file.isStarred ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); handleStarFile(file); }}>
                            <Star size={16} fill={file.isStarred ? "currentColor" : "none"} />
                          </button>
                        </div>

                        <div className="file-details-wrapper">
                          <h4 className="file-name-v2" title={file.originalName}>{file.originalName}</h4>
                          <div className="file-meta-row">
                            <span>{formatSize(file.size)}</span>
                            <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="file-card-actions">
                          {file.passwordLock ? (
                            <button className="file-action-icon-btn" style={{ color: "var(--warning)" }} onClick={() => setLockFileItem(file)}>
                              <Lock size={14} />
                            </button>
                          ) : (
                            <button className="file-action-icon-btn" onClick={() => setLockFileItem(file)}>
                              <Unlock size={14} />
                            </button>
                          )}
                          <button className="file-action-icon-btn" onClick={() => handleDownload(file)}>
                            <Download size={14} />
                          </button>
                          <button className="file-action-icon-btn" onClick={() => handleRenameFile(file)}>
                            <Pencil size={14} />
                          </button>
                          <button className="file-action-icon-btn" onClick={() => setShareFileItem(file)}>
                            <Share2 size={14} />
                          </button>
                          <button className="file-action-icon-btn" style={{ color: "var(--danger)" }} onClick={() => handleTrashFile(file)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="files-layout-list">
                    {files.map((file) => (
                      <div key={file._id} className="file-list-item">
                        <div className="file-list-icon">
                          <FileIcon size={20} />
                        </div>
                        <span className="file-list-name" style={{ cursor: "pointer" }} onClick={() => setPreviewFile(file)}>{file.originalName}</span>
                        <span className="file-list-meta">{file.category.toUpperCase()}</span>
                        <span className="file-list-meta">{formatSize(file.size)}</span>
                        <span className="file-list-meta">{new Date(file.createdAt).toLocaleDateString()}</span>
                        
                        <div className="file-list-actions">
                          <button className="file-action-icon-btn" onClick={() => handleStarFile(file)}>
                            <Star size={14} fill={file.isStarred ? "var(--warning)" : "none"} color={file.isStarred ? "var(--warning)" : "var(--text-muted)"} />
                          </button>
                          <button className="file-action-icon-btn" onClick={() => handleDownload(file)}>
                            <Download size={14} />
                          </button>
                          <button className="file-action-icon-btn" onClick={() => setShareFileItem(file)}>
                            <Share2 size={14} />
                          </button>
                          <button className="file-action-icon-btn" style={{ color: "var(--danger)" }} onClick={() => handleTrashFile(file)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ─── FAVORITES TAB ─── */}
        {activeTab === "starred" && (
          <div className="files-layout-list">
            <h3 style={{ marginBottom: "20px" }}>Starred Elements</h3>
            {files.filter(f => f.isStarred).length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No starred components logged.</p>
            ) : (
              files.filter(f => f.isStarred).map((file) => (
                <div key={file._id} className="file-list-item">
                  <div className="file-list-icon">
                    <Star size={20} fill="var(--warning)" color="var(--warning)" />
                  </div>
                  <span className="file-list-name">{file.originalName}</span>
                  <span className="file-list-meta">{formatSize(file.size)}</span>
                  <div className="file-list-actions">
                    <button className="file-action-icon-btn" onClick={() => handleStarFile(file)}>
                      Remove
                    </button>
                    <button className="file-action-icon-btn" onClick={() => handleDownload(file)}>
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── INSIGHT ANALYTICS TAB ─── */}
        {activeTab === "insights" && (
          <div className="analytics-section">
            {/* Chart Card */}
            <div className="analytics-card">
              <h3 style={{ marginBottom: "20px" }}>Storage Division Metrics</h3>
              <div className="chart-wrapper">
                <div className="donut-chart" style={{ background: storageSummaryStats.styleGradient }}>
                  <div className="donut-center">
                    <span style={{ fontSize: "20px", fontWeight: "800" }}>{Math.round((currentStorageUsed / STORAGE_LIMIT) * 100)}%</span>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>OF 15 GB USED</span>
                  </div>
                </div>
              </div>

              {/* Legends */}
              <div className="chart-legends">
                {Object.entries(storageSummaryStats.stats).map(([cat, size]) => (
                  <div key={cat} className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: CATEGORY_COLORS[cat] }}></div>
                    <span style={{ textTransform: "uppercase", fontWeight: "600" }}>{cat}:</span>
                    <span>{formatSize(size)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 5 largest files card */}
            <div className="analytics-card">
              <h3 style={{ marginBottom: "20px" }}>Largest Files</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {topFiveFiles.map((file, idx) => (
                  <div key={file._id} style={{ display: "flex", alignItems: "center", justifyItems: "center", gap: "12px", background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--secondary)" }}>#{idx + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.originalName}</p>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Category: {file.category.toUpperCase()}</span>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: "700" }}>{formatSize(file.size)}</span>
                  </div>
                ))}
                {topFiveFiles.length === 0 && (
                  <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No files uploaded yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── CRYPTOGRAPHIC ACTION LOGS ─── */}
        {activeTab === "activity" && (
          <div className="analytics-card" style={{ maxWidth: "800px" }}>
            <h3 style={{ marginBottom: "16px" }}>Recent Activity</h3>
            <div className="activity-list">
              {activities.map((act) => (
                <div key={act._id} className="activity-item">
                  <div className="activity-icon-wrapper">
                    <Clock size={14} />
                  </div>
                  <div className="activity-content">
                    <p className="activity-text">
                      <strong>{act.actorName}</strong> {act.action} {act.targetType} <strong>{act.targetName}</strong>
                    </p>
                    <span className="activity-time">{new Date(act.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <p style={{ color: "var(--text-muted)" }}>No activity yet.</p>
              )}
            </div>
          </div>
        )}

        {/* ─── TRASH DISPOSAL TAB ─── */}
        {activeTab === "trash" && (
          <div className="files-layout-list">
            {files.length === 0 ? (
              <p style={{ color: "var(--text-muted)", padding: "40px 0" }}>Trash is empty.</p>
            ) : (
              files.map((file) => (
                <div key={file._id} className="file-list-item" style={{ opacity: 0.7 }}>
                  <div className="file-list-icon">
                    <Trash2 size={20} color="var(--danger)" />
                  </div>
                  <span className="file-list-name" style={{ flex: 2 }}>{file.originalName}</span>
                  <span className="file-list-meta">{formatSize(file.size)}</span>
                  <span className="file-list-meta">Trashed: {file.trashedAt ? new Date(file.trashedAt).toLocaleDateString() : "Pending"}</span>
                  
                  <div className="file-list-actions">
                    <button className="btn-secondary" style={{ padding: "6px 14px", fontSize: "13px" }} onClick={() => handleRestoreFile(file)}>
                      Restore
                    </button>
                    <button style={{ padding: "6px 14px", fontSize: "13px", background: "var(--danger)", color: "white", borderRadius: "8px", border: "none", cursor: "pointer" }} onClick={() => handlePermanentDelete(file)}>
                      Delete Forever
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="mobile-bottom-nav">
        <button className={`mobile-nav-item ${activeTab === "drive" ? "active" : ""}`} onClick={() => setActiveTab("drive")}>
          <Cloud size={20} />
          <span>Drive</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === "starred" ? "active" : ""}`} onClick={() => setActiveTab("starred")}>
          <Star size={20} />
          <span>Starred</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === "insights" ? "active" : ""}`} onClick={() => setActiveTab("insights")}>
          <BarChart3 size={20} />
          <span>Insight</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === "activity" ? "active" : ""}`} onClick={() => setActiveTab("activity")}>
          <Clock size={20} />
          <span>Log</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === "trash" ? "active" : ""}`} onClick={() => setActiveTab("trash")}>
          <Trash2 size={20} />
          <span>Trash</span>
        </button>
      </nav>

      {/* MULTI UPLOAD PROGRESS TRAY */}
      {uploadList.length > 0 && (
        <div className="upload-tray">
          <div className="upload-tray-header">Engaging Encrypted Stream</div>
          <div className="upload-tray-list">
            {uploadList.map((item) => (
              <div key={item.id} className="upload-progress-item">
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                  <span className="upload-progress-name">{item.name}</span>
                  <span>{item.progress}%</span>
                </div>
                <div className="upload-progress-bar-bg">
                  <div className="upload-progress-bar-fill" style={{ width: `${item.progress}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FOLDER CRUD MODAL */}
      {showFolderModal && (
        <div className="modal-backdrop" onClick={() => setShowFolderModal(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSaveFolder}>
            <h2>{folderForm.id ? "Alter Directory Keys" : "Initialize Directory"}</h2>
            
            <div className="modal-input-grid">
              <div className="input-group">
                <label className="input-label" htmlFor="folder-name-input">Directory Title</label>
                <input
                  id="folder-name-input"
                  className="input-field"
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                  placeholder="Secret Archives..."
                  required
                />
              </div>

              {/* Color choices */}
              <div>
                <label className="input-label">Directory Highlight</label>
                <div className="color-option-row">
                  {["blue", "purple", "green", "orange", "red", "pink", "cyan", "yellow"].map((color) => (
                    <div
                      key={color}
                      className={`color-dot ${folderForm.color === color ? "selected" : ""}`}
                      style={{ backgroundColor: CATEGORY_COLORS[color === "blue" ? "word" : color === "purple" ? "image" : color === "green" ? "excel" : color === "orange" ? "powerpoint" : color === "red" ? "pdf" : color === "pink" ? "audio" : color === "cyan" ? "video" : "other"] }}
                      onClick={() => setFolderForm({ ...folderForm, color })}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" type="button" onClick={() => setShowFolderModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" type="submit">
                Initialize
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DOWNLOAD PASSWORD MODAL */}
      {pendingDownloadFile && (
        <div className="modal-backdrop" onClick={() => setPendingDownloadFile(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <ShieldAlert size={40} color="var(--warning)" style={{ display: "block", margin: "0 auto 16px" }} />
            <h2 style={{ textAlign: "center" }}>Decryption Key Required</h2>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", marginTop: "8px" }}>
              This resource is locked. Input credentials to authorize downstream access.
            </p>

            <input
              type="password"
              className="input-field"
              placeholder="Decryption password..."
              style={{ marginTop: "16px" }}
              value={downloadPassword}
              onChange={(e) => setDownloadPassword(e.target.value)}
            />

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setPendingDownloadFile(null)}>
                Abort
              </button>
              <button className="btn-primary" onClick={() => handleDownload(pendingDownloadFile, downloadPassword)}>
                Decrypt & Stream
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ENGAGE LOCK MODAL */}
      {lockFileItem && (
        <div className="modal-backdrop" onClick={() => setLockFileItem(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleLockFile}>
            <h2>Configure Lock Padlock</h2>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
              Setting a lock password restricts access to unauthorized viewers. Leave empty to unlock.
            </p>

            <input
              type="password"
              className="input-field"
              placeholder="Lock password (empty to remove)..."
              style={{ marginTop: "16px" }}
              value={lockPassword}
              onChange={(e) => setLockPassword(e.target.value)}
            />

            <div className="modal-footer">
              <button className="btn-secondary" type="button" onClick={() => setLockFileItem(null)}>
                Cancel
              </button>
              <button className="btn-primary" type="submit">
                Save padlock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SHARE FILE MODAL */}
      {shareFileItem && (
        <div className="modal-backdrop" onClick={() => { setShareFileItem(null); setSharePublicLink(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Share File Resource</h2>
            
            <form onSubmit={handleShareFile} style={{ marginTop: "16px" }}>
              <div className="input-group">
                <label className="input-label" htmlFor="share-email-input">User Email Address</label>
                <input
                  id="share-email-input"
                  type="email"
                  className="input-field"
                  placeholder="target@vault.com"
                  value={shareForm.email}
                  onChange={(e) => setShareForm({ ...shareForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="share-access-select">Access Privilege</label>
                <select
                  id="share-access-select"
                  className="input-field"
                  value={shareForm.access}
                  onChange={(e) => setShareForm({ ...shareForm, access: e.target.value })}
                >
                  <option value="view">Viewer Mode (Read-only)</option>
                  <option value="edit">Editor Mode (Write/Delete)</option>
                </select>
              </div>

              <button className="btn-primary" type="submit">Invite Collaborator</button>
            </form>

            <div className="divider">PUBLIC DISCOVERY</div>

            {!sharePublicLink ? (
              <button className="btn-secondary" onClick={() => handleGeneratePublicLink(shareFileItem)}>
                Generate Share Link
              </button>
            ) : (
              <div style={{ marginTop: "10px" }}>
                <input className="input-field" readOnly value={sharePublicLink} onClick={(e) => e.target.select()} />
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
                  Expiry scheduled automatically in 7 days.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SHARE FOLDER MODAL */}
      {shareFolderItem && (
        <div className="modal-backdrop" onClick={() => { setShareFolderItem(null); setFolderInviteLink(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Invite to Folder</h2>
            
            <form onSubmit={handleShareFolder} style={{ marginTop: "16px" }}>
              <div className="input-group">
                <label className="input-label" htmlFor="folder-share-email">Security Email Address</label>
                <input
                  id="folder-share-email"
                  type="email"
                  className="input-field"
                  placeholder="collaborator@nimbus.com"
                  value={folderInviteForm.email}
                  onChange={(e) => setFolderInviteForm({ ...folderInviteForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="folder-share-access">Collaboration Role</label>
                <select
                  id="folder-share-access"
                  className="input-field"
                  value={folderInviteForm.access}
                  onChange={(e) => setFolderInviteForm({ ...folderInviteForm, access: e.target.value })}
                >
                  <option value="view">Guest Viewer (Read-only)</option>
                  <option value="upload">Authorized Contributor (Upload files)</option>
                </select>
              </div>

              <button className="btn-primary" type="submit">Invite Collaborator</button>
            </form>

            <div className="divider">GUEST VIEW LINK</div>

            {!folderInviteLink ? (
              <button className="btn-secondary" onClick={() => handleGenerateFolderInviteLink(shareFolderItem)}>
                Generate Folder Invite Link
              </button>
            ) : (
              <div style={{ marginTop: "10px" }}>
                <input className="input-field" readOnly value={folderInviteLink} onClick={(e) => e.target.select()} />
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
                  Anyone with this link can view the files in this folder (no login required).
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULL SCREEN SMART FILE PREVIEW OVERLAY */}
      {previewFile && (
        <div className="preview-overlay">
          <nav className="preview-nav">
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button className="file-action-icon-btn" onClick={() => setPreviewFile(null)}>
                <ArrowLeft size={20} />
              </button>
              <h3 style={{ fontSize: "16px" }}>{previewFile.originalName}</h3>
            </div>
            
            <div style={{ display: "flex", gap: "12px" }}>
              <button className="btn-secondary" style={{ padding: "8px 16px" }} onClick={() => handleDownload(previewFile)}>
                <Download size={16} /> Download
              </button>
              <button className="btn-primary" style={{ padding: "8px 16px" }} onClick={() => { setShareFileItem(previewFile); setPreviewFile(null); }}>
                Share
              </button>
            </div>
          </nav>

          <div className="preview-body">
            {/* IMAGE PREVIEW */}
            {previewFile.category === "image" && (
              <img src={`http://localhost:5000/uploads/${previewFile.storedName}`} className="preview-media" alt={previewFile.originalName} />
            )}

            {/* VIDEO PREVIEW */}
            {previewFile.category === "video" && (
              <video src={`http://localhost:5000/uploads/${previewFile.storedName}`} controls className="preview-media" />
            )}

            {/* AUDIO PREVIEW */}
            {previewFile.category === "audio" && (
              <div className="preview-audio-container">
                <FileIcon size={64} color="var(--secondary)" />
                <h4>Audio Component Loaded</h4>
                <audio src={`http://localhost:5000/uploads/${previewFile.storedName}`} controls autoPlay />
              </div>
            )}

            {/* PDF PREVIEW */}
            {previewFile.category === "pdf" && (
              <iframe src={`http://localhost:5000/uploads/${previewFile.storedName}`} className="preview-pdf-embed" title="PDF Preview" />
            )}

            {/* OTHER FILE TYPES PREVIEW */}
            {!["image", "video", "audio", "pdf"].includes(previewFile.category) && (
              <div className="preview-audio-container" style={{ textAlign: "center" }}>
                <FileIcon size={80} color="var(--text-muted)" />
                <h3 style={{ marginTop: "16px" }}>No Smart Preview Available</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "8px" }}>
                  This file type ({previewFile.mimeType}) cannot be rendered directly in-browser. Please download to view locally.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── PUBLIC / ANONYMOUS GUEST VIEW FOR SHARED FOLDER LINKS ─── */
function PublicFolderView({ token, theme, setTheme }) {
  const [folderData, setFolderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPublicFolder = async () => {
      try {
        const { data } = await fetchPublicFolderApi(token);
        setFolderData(data.data);
      } catch (err) {
        setError("This invite link has expired or is invalid.");
      } finally {
        setLoading(false);
      }
    };
    fetchPublicFolder();
  }, [token]);

  const handleDownloadPublicFile = async (file) => {
    try {
      const response = await downloadFileApi(file._id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Failed to download resource. It might be password protected.");
    }
  };

  return (
    <main className="public-folder-page">
      <header className="top-bar" style={{ marginBottom: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="logo-icon" style={{ padding: "8px" }}>
            <Cloud size={22} />
          </div>
          <span className="brand-text" style={{ fontSize: "20px" }}>NimbusVault Shared Space</span>
        </div>

        <button className="theme-toggle-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {loading ? (
        <p style={{ textAlign: "center", marginTop: "100px", color: "var(--text-muted)" }}>Decoding directory space...</p>
      ) : error ? (
        <div className="auth-card" style={{ margin: "100px auto", textAlign: "center" }}>
          <ShieldAlert size={48} color="var(--danger)" style={{ display: "block", margin: "0 auto 16px" }} />
          <h3>Access Revoked or Link Expired</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "8px" }}>{error}</p>
        </div>
      ) : (
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <FolderOpen size={32} color="var(--secondary)" />
            <div>
              <h2 style={{ fontSize: "24px" }}>{folderData.folder.name}</h2>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Guest Access Enabled · Read Only Mode</span>
            </div>
          </div>

          <div className="section-header" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "10px", marginBottom: "16px" }}>
            <h3>Folder Contents ({folderData.files.length} items)</h3>
          </div>

          {folderData.files.length === 0 ? (
            <div className="empty-illustration">
              <Cloud size={64} style={{ opacity: 0.15 }} />
              <h3>This directory is empty</h3>
              <p>The owner has not uploaded any files inside this directory yet.</p>
            </div>
          ) : (
            <div className="files-layout-list">
              {folderData.files.map((file) => (
                <div key={file._id} className="file-list-item">
                  <div className="file-list-icon">
                    <FileIcon size={20} />
                  </div>
                  <span className="file-list-name" style={{ flex: 3 }}>{file.originalName}</span>
                  <span className="file-list-meta" style={{ flex: 1 }}>{file.category.toUpperCase()}</span>
                  <span className="file-list-meta" style={{ flex: 1 }}>{formatSize(file.size)}</span>
                  <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => handleDownloadPublicFile(file)}>
                    <Download size={14} style={{ marginRight: "6px" }} /> Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
