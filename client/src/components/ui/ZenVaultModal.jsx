import { useState, useEffect, useRef } from "react";
import { db } from "../../db/zenDB";
import { useAuthStore } from "../../stores/authStore";

const ZenVaultModal = ({ isOpen, onClose }) => {
    const { user } = useAuthStore();
    const [vaultState, setVaultState] = useState("locked"); // "setup", "locked", "unlocked"
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [files, setFiles] = useState([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Store derived key in ref so it is purely in-memory and cleared on lock
    const activeKeyRef = useRef(null);
    const fileInputRef = useRef(null);

    const userPrefix = user ? user._id : "default";
    const saltKey = `zenvault_salt_${userPrefix}`;
    const tokenKey = `zenvault_token_${userPrefix}`;
    const ivKey = `zenvault_iv_${userPrefix}`;

    useEffect(() => {
        if (isOpen) {
            checkSetup();
        }
    }, [isOpen, userPrefix]);

    useEffect(() => {
        if (vaultState === "unlocked") {
            loadFiles();
        }
    }, [vaultState]);

    const checkSetup = () => {
        const token = localStorage.getItem(tokenKey);
        if (token) {
            setVaultState("locked");
        } else {
            setVaultState("setup");
        }
        setError("");
        setSuccess("");
        setPassword("");
        setConfirmPassword("");
    };

    const loadFiles = async () => {
        try {
            if (db.vault) {
                const list = await db.vault.toArray();
                setFiles(list.sort((a, b) => b.date - a.date));
            }
        } catch (err) {
            console.error("Failed to load vault files:", err);
        }
    };

    // Helper functions for Web Crypto
    const getSalt = () => {
        let saltHex = localStorage.getItem(saltKey);
        if (!saltHex) {
            const salt = window.crypto.getRandomValues(new Uint8Array(16));
            saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
            localStorage.setItem(saltKey, saltHex);
        }
        const bytes = new Uint8Array(16);
        for (let i = 0; i < 16; i++) {
            bytes[i] = parseInt(saltHex.substr(i * 2, 2), 16);
        }
        return bytes;
    };

    const deriveKey = async (pass) => {
        const salt = getSalt();
        const encoder = new TextEncoder();
        const importedKey = await window.crypto.subtle.importKey(
            "raw",
            encoder.encode(pass),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            importedKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    };

    const handleSetup = async (e) => {
        e.preventDefault();
        setError("");
        if (password.length < 3 || password.length > 8) {
            setError("Password must be between 3 and 8 characters long.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsLoading(true);
        try {
            const derived = await deriveKey(password);
            const encoder = new TextEncoder();
            const tokenBytes = encoder.encode("zenvault-validation-token");
            const iv = window.crypto.getRandomValues(new Uint8Array(12));

            const encrypted = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv },
                derived,
                tokenBytes
            );

            const tokenHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, "0")).join("");
            const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join("");

            localStorage.setItem(tokenKey, tokenHex);
            localStorage.setItem(ivKey, ivHex);

            activeKeyRef.current = derived;
            setVaultState("unlocked");
            setSuccess("Vault initialized successfully!");
        } catch (err) {
            console.error("Vault setup failed:", err);
            setError("Cryptographic setup failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnlock = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const tokenHex = localStorage.getItem(tokenKey);
            const ivHex = localStorage.getItem(ivKey);

            if (!tokenHex || !ivHex) {
                setVaultState("setup");
                setIsLoading(false);
                return;
            }

            const tokenBytes = new Uint8Array(tokenHex.length / 2);
            for (let i = 0; i < tokenBytes.length; i++) {
                tokenBytes[i] = parseInt(tokenHex.substr(i * 2, 2), 16);
            }

            const ivBytes = new Uint8Array(12);
            for (let i = 0; i < 12; i++) {
                ivBytes[i] = parseInt(ivHex.substr(i * 2, 2), 16);
            }

            const derived = await deriveKey(password);

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: ivBytes },
                derived,
                tokenBytes
            );

            const decoder = new TextDecoder();
            const decryptedText = decoder.decode(decrypted);

            if (decryptedText === "zenvault-validation-token") {
                activeKeyRef.current = derived;
                setVaultState("unlocked");
                setPassword("");
            } else {
                setError("Incorrect password.");
            }
        } catch (err) {
            console.error("Vault decrypt verification failed:", err);
            setError("Incorrect password or corrupt validation token.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLock = () => {
        activeKeyRef.current = null;
        setVaultState("locked");
        setPassword("");
        setConfirmPassword("");
        setError("");
        setSuccess("");
    };

    const formatBytes = (bytes, decimals = 2) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    };

    const handleFileUpload = async (filesToUpload) => {
        if (!activeKeyRef.current) return;
        setIsLoading(true);
        setError("");

        try {
            for (let file of filesToUpload) {
                const reader = new FileReader();
                const fileDataPromise = new Promise((resolve, reject) => {
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error);
                });
                reader.readAsArrayBuffer(file);
                const fileBuffer = await fileDataPromise;

                const iv = window.crypto.getRandomValues(new Uint8Array(12));
                const encrypted = await window.crypto.subtle.encrypt(
                    { name: "AES-GCM", iv },
                    activeKeyRef.current,
                    fileBuffer
                );

                const fileId = window.crypto.randomUUID ? window.crypto.randomUUID() : (Date.now().toString() + Math.random().toString(36).substr(2, 9));

                await db.vault.put({
                    id: fileId,
                    name: file.name,
                    type: file.type || "application/octet-stream",
                    size: file.size,
                    date: Date.now(),
                    iv: Array.from(iv),
                    payload: encrypted
                });
            }
            loadFiles();
            setSuccess("File(s) encrypted and saved successfully!");
        } catch (err) {
            console.error("Encryption failed:", err);
            setError("Failed to encrypt and store file.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files);
        }
    };

    const downloadFile = async (file) => {
        if (!activeKeyRef.current) return;
        setIsLoading(true);
        try {
            const ivBytes = new Uint8Array(file.iv);
            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: ivBytes },
                activeKeyRef.current,
                file.payload
            );

            const blob = new Blob([decrypted], { type: file.type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Decryption failed:", err);
            setError("Failed to decrypt file. Invalid key or corrupted data.");
        } finally {
            setIsLoading(false);
        }
    };

    const deleteFile = async (id) => {
        if (!confirm("Are you sure you want to permanently delete this file? It cannot be recovered.")) return;
        try {
            await db.vault.delete(id);
            loadFiles();
            setSuccess("File deleted from local safe.");
        } catch (err) {
            console.error("Deletion failed:", err);
            setError("Failed to delete file.");
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(10, 15, 30, 0.75)",
            backdropFilter: "blur(20px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
        }}>
            <div style={{
                background: "var(--color-surface, rgba(15, 23, 42, 0.65))",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "24px",
                width: "100%",
                maxWidth: "600px",
                maxHeight: "85vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
                fontFamily: "inherit",
                color: "#fff"
            }}>
                {/* Header */}
                <div style={{
                    padding: "20px 24px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(255, 255, 255, 0.01)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700", letterSpacing: "-0.3px" }}>
                            ZenVault
                            <span style={{ fontSize: "0.7rem", verticalAlign: "middle", background: "rgba(61, 165, 217, 0.15)", color: "var(--color-primary)", padding: "2px 8px", borderRadius: "10px", marginLeft: "10px", fontWeight: "600" }}>LOCAL SAFE</span>
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            color: "#94a3b8",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center",
                            borderRadius: "50%",
                            transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                    >
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content Area */}
                <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                    {error && (
                        <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#f87171", padding: "10px 14px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: "500" }}>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", color: "#34d399", padding: "10px 14px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: "500" }}>
                            {success}
                        </div>
                    )}

                    {/* Setup State */}
                    {vaultState === "setup" && (
                        <form onSubmit={handleSetup} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div style={{ background: "rgba(61, 165, 217, 0.04)", border: "1px solid rgba(61, 165, 217, 0.1)", padding: "14px", borderRadius: "12px", fontSize: "0.8rem", color: "#94a3b8", lineHeight: "1.5" }}>
                                <strong style={{ color: "#fff", display: "block", marginBottom: "6px" }}>Set up your ZenVault Password</strong>
                                Unlike device-level locks (like biometrics or pin codes) which can be bypassed by anyone who knows your device passcode, ZenVault secures your files with custom 256-bit AES-GCM local encryption right inside your browser. Your password never leaves this device, meaning zero server footprint and complete privacy - but remember, if you lose it, we can't recover your files!
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>Vault Password</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="3 to 8 characters/numbers"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    style={{ background: "rgba(0, 0, 0, 0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 14px", fontSize: "0.9rem", color: "#fff" }}
                                />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="Re-enter password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    style={{ background: "rgba(0, 0, 0, 0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 14px", fontSize: "0.9rem", color: "#fff" }}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                style={{ background: "var(--color-primary)", color: "#000", border: "none", borderRadius: "10px", padding: "12px", fontSize: "0.9rem", fontWeight: "700", cursor: "pointer", transition: "opacity 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                                {isLoading ? "Initializing Cryptography..." : "Initialize Local Safe"}
                            </button>
                        </form>
                    )}

                    {/* Locked State */}
                    {vaultState === "locked" && (
                        <form onSubmit={handleUnlock} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}>
                                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", padding: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600", textAlign: "center" }}>Enter Vault Password to Unlock Safe</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    style={{ background: "rgba(0, 0, 0, 0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "12px 14px", fontSize: "1rem", color: "#fff", textAlign: "center" }}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                style={{ background: "var(--color-primary)", color: "#000", border: "none", borderRadius: "10px", padding: "12px", fontSize: "0.9rem", fontWeight: "700", cursor: "pointer", transition: "opacity 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                                {isLoading ? "Unlocking Safe..." : "Unlock Safe"}
                            </button>
                        </form>
                    )}

                    {/* Unlocked State (Vault Dashboard) */}
                    {vaultState === "unlocked" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                            {/* Drag/Drop Zone */}
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={handleFileDrop}
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: isDragOver ? "2px dashed var(--color-primary)" : "2px dashed rgba(255, 255, 255, 0.15)",
                                    background: isDragOver ? "rgba(61, 165, 217, 0.05)" : "rgba(0, 0, 0, 0.15)",
                                    borderRadius: "16px",
                                    padding: "24px",
                                    textAlign: "center",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                            >
                                <input
                                    type="file"
                                    multiple
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    style={{ display: "none" }}
                                />
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "8px" }}>
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                                <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "600" }}>Drag & drop files here, or tap to browse</p>
                                <p style={{ margin: "4px 0 0 0", fontSize: "0.72rem", color: "#64748b" }}>Files are encrypted locally before being stored.</p>
                            </div>

                            {/* Actions Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: "600" }}>SECURE STORAGE ({files.length} items)</span>
                                <button
                                    onClick={handleLock}
                                    style={{
                                        background: "rgba(239, 68, 68, 0.12)",
                                        border: "1px solid rgba(239, 68, 68, 0.25)",
                                        color: "#ef4444",
                                        borderRadius: "8px",
                                        padding: "6px 12px",
                                        fontSize: "0.75rem",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px"
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    Lock Safe
                                </button>
                            </div>

                            {/* Files List */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {files.length === 0 ? (
                                    <div style={{ textAlign: "center", padding: "40px 20px", background: "rgba(255,255,255,0.01)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.03)", color: "#64748b", fontSize: "0.8rem" }}>
                                        Safe is empty. Encrypt files to protect them.
                                    </div>
                                ) : (
                                    files.map(f => (
                                        <div key={f.id} style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            background: "rgba(255, 255, 255, 0.02)",
                                            border: "1px solid rgba(255, 255, 255, 0.05)",
                                            padding: "12px 16px",
                                            borderRadius: "12px",
                                            transition: "background 0.2s"
                                        }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)"}
                                            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)"}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px", overflow: "hidden", marginRight: "10px" }}>
                                                <div style={{ background: "rgba(61, 165, 217, 0.1)", borderRadius: "8px", padding: "8px", display: "flex", alignItems: "center" }}>
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                        <polyline points="14 2 14 8 20 8" />
                                                    </svg>
                                                </div>
                                                <div style={{ overflow: "hidden" }}>
                                                    <div style={{ fontSize: "0.82rem", fontWeight: "600", color: "#fff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }} title={f.name}>{f.name}</div>
                                                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
                                                        {formatBytes(f.size)} • {new Date(f.date).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", gap: "8px" }}>
                                                <button
                                                    onClick={() => downloadFile(f)}
                                                    style={{
                                                        background: "rgba(255, 255, 255, 0.06)",
                                                        border: "1px solid rgba(255, 255, 255, 0.1)",
                                                        color: "#fff",
                                                        padding: "6px",
                                                        borderRadius: "8px",
                                                        cursor: "pointer",
                                                        display: "flex",
                                                        alignItems: "center"
                                                    }}
                                                    title="Decrypt and Download"
                                                >
                                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => deleteFile(f.id)}
                                                    style={{
                                                        background: "rgba(239, 68, 68, 0.06)",
                                                        border: "1px solid rgba(239, 68, 68, 0.15)",
                                                        color: "#f87171",
                                                        padding: "6px",
                                                        borderRadius: "8px",
                                                        cursor: "pointer",
                                                        display: "flex",
                                                        alignItems: "center"
                                                    }}
                                                    title="Delete permanently"
                                                >
                                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ZenVaultModal;
