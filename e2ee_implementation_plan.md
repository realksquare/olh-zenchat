# Implementation Plan: ZenChat End-to-End Encryption (E2EE) & Password Recovery

This document details the architectural design, security properties, API contracts, and step-by-step implementation roadmap for adding End-to-End Encryption (E2EE) and a secure Password Recovery system to ZenChat.

---

## 1. Password Reset & E2EE Key Recovery Lifecycle (The Mathematical Truth)
In a zero-knowledge E2EE system, if a user completely forgets their account password, their encrypted private key backup on the server becomes **permanently undecryptable**. 
To resolve this while keeping their chat history safe, ZenChat implements two symmetric recovery paths:

### Path A: The "Clean Slate" Reset (Default Zero-Friction Model)
1. **Password Reset:** The user resets their password via a secure email token reset.
2. **Server Deletion:** Since the old encrypted private key is undecryptable without the old password, the server **permanently deletes** the old `encryptedPrivateKey` and resets `publicKey = null`.
3. **Local Cache Safety:** Their historical messages remain **100% safe and visible** on their current device (since the local IndexedDB cache is already decrypted!).
4. **Key Regeneration:** On the next login, the client detects that `publicKey` is null, automatically generates a new key pair using the new password, and registers it.

### Path B: The "Offline Recovery Key" (High-Security Advanced Model)
1. **Initial Setup:** On E2EE activation, the client generates a random, cryptographically secure 16-character **Recovery Key** (e.g., `ZNC-X9RT-K4WP-Q2LM`).
2. **Double Encryption:** The client derives a key from this Recovery Key, encrypts the Private RSA Key with it, and uploads this second bundle to `encryptedPrivateKeyBackup`.
3. **Recovery Flow:** If the user resets their password, they can log in on a *new device* and input their **Recovery Key** to successfully download, decrypt, and restore their entire historical chat history!

```mermaid
graph TD
    A[User Forgot Password] --> B{Choose Reset Path}
    B -->|Path A: Clean Slate| C[Email Reset Link]
    C --> D[Set New Password]
    D --> E[Server Deletes Old Encrypted Private Key]
    E --> F[Existing Device: Offline History Kept]
    E --> G[New Device: Key Regenerated, Fresh Start]
    
    B -->|Path B: Recovery Key| H[Input 16-char Recovery Key]
    H --> I[Decrypt Server Backup Key]
    I --> J[New Device: Entire History Fully Decrypted]
```

---

## 2. Implementing the "Forgot Password" Backend & UI

Since ZenChat does not have a password recovery mechanism yet, we will implement a secure, standard-compliant flow:

### A. Backend Endpoints (`server/routes/auth.js`)
1. **`POST /api/auth/forgot-password`**
   * Receives: `{ email }`
   * Action: 
     * Verifies if user exists.
     * Generates a secure, random hex token using `crypto.randomBytes(20)`.
     * Sets `resetPasswordToken` and `resetPasswordExpires = Date.now() + 3600000` (1 hour).
     * Sends a rich HTML reset link (`https://zenchat.onrender.com/reset-password/:token`) using **Nodemailer** with SMTP (e.g., Resend, SendGrid, or Gmail).
2. **`POST /api/auth/reset-password/:token`**
   * Receives: `{ newPassword }`
   * Action:
     * Finds the user with `resetPasswordToken = token` and `resetPasswordExpires > Date.now()`.
     * **Password Strength Enforcer:** Validates that `newPassword` satisfies the strict security standard: **7 to 18 characters long, containing at least one numeric digit**.
     * **Password Reuse Prevention:** Compares the hashed `newPassword` against the user's current hashed password using `bcrypt.compare`. If they match, returns a 400 Bad Request: *"New password cannot be the same as your current password. Please choose a different one."*
     * Hashes the `newPassword` using bcrypt.
     * **CRITICAL FOR E2EE:** Wipes the old `encryptedPrivateKey` and sets `publicKey = null` (Path A trigger).
     * Clears token fields and saves.

### B. Frontend Pages (`client/src/pages/`)
1. **Forgot Password Screen:** A beautiful, responsive card layout prompting for email, showing smooth button loading states, and firing to `/forgot-password`.
2. **Reset Password Screen (`/reset-password/:token`):** Prompts for their new password, enforces the 7-18 char & numeric validation checks on the frontend in real-time, displays secure password requirements checklist, fires to the reset endpoint, and redirects to login with a premium success notification.

---

## 3. Database Schema Changes

### A. Mongoose User Model (`server/models/User.js`)
```javascript
const UserSchema = new mongoose.Schema({
  // ... existing fields ...
  
  // Forgot Password Tokens
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },

  // E2EE Cryptographic Fields
  publicKey: { type: String, default: null }, // Plain JWK String
  encryptedPrivateKey: { type: String, default: null }, // AES-GCM (Encrypted with Password)
  encryptedPrivateKeyBackup: { type: String, default: null }, // AES-GCM (Encrypted with Recovery Key)
  cryptoSalt: { type: String, default: null }, // PBKDF2 Salt
  cryptoIv: { type: String, default: null }, // AES-GCM IV
});
```

### B. Client IndexedDB Store (`client/src/db/zenDB.js`)
We cache their local cryptographic key pair and recovery status:
```javascript
db.version(4).stores({
  chats: "_id, updatedAt, lastMessage._id",
  messages: "_id, chatId, createdAt, senderId",
  outbox: "++id, chatId, createdAt",
  keys: "key, value" // Keys: 'privateKey', 'publicKey', 'recoveryKeySaved'
});
```

---

## 4. Cryptographic Helper Module (`client/src/utils/crypto.js`)

We will build a high-performance utility file wrapping the native **Web Crypto API**:
* `generateUserKeys(password, recoveryKey)`: Generates RSA-OAEP 2048-bit keys. Derives separate AES-256 keys from (1) the password (via PBKDF2) and (2) the Recovery Key. Encrypts the Private Key under both, returning the public key, password-encrypted bundle, and recovery-encrypted backup bundle.
* `decryptPrivateKeyWithPassword(encryptedBundle, password)`: Decrypts the private key.
* `decryptPrivateKeyWithRecoveryKey(backupBundle, recoveryKey)`: Recovers the private key.
* `encryptMessageContent(plaintext, recipientPublicKey)`: Generates ephemeral symmetric AES-GCM key, encrypts text, encrypts AES key with RSA-OAEP.
* `decryptMessageContent(ciphertext, encryptedAesKey, iv, privateKey)`: Decrypts symmetric key, then decrypts the ciphertext.

---

## 5. End-to-End API Contracts

### A. Register Cryptographic Keys
* **Endpoint:** `POST /api/auth/keys`
* **Headers:** `Authorization: Bearer <token>`
* **Payload:**
  ```json
  {
    "publicKey": "...",
    "encryptedPrivateKey": "...",
    "encryptedPrivateKeyBackup": "...",
    "cryptoSalt": "...",
    "cryptoIv": "..."
  }
  ```

### B. Fetch Recipient Public Key
* **Endpoint:** `GET /api/users/:id/public-key`
* **Response:**
  ```json
  {
    "publicKey": "..."
  }
  ```

---

## 6. Detailed Step-by-Step Implementation Plan

### Step 1: Nodemailer Configuration & Forgot Password Backend
* Install `nodemailer` in the backend.
* Create a dedicated mail service module `server/services/mailService.js` to dispatch responsive branding email templates.
* Add forgot/reset route logic inside `server/routes/auth.js`.

### Step 2: Forgot/Reset Password Frontend Pages
* Build beautiful, secure forms in the client matching ZenChat's elegant dark glassmorphism design tokens.
* Wire up client-side routes in `App.jsx`.

### Step 3: Web Crypto API Module & IndexedDB Schema Upgrade
* Implement `client/src/utils/crypto.js` using Web Crypto API.
* Upgrade Dexie schema version in `client/src/db/zenDB.js` to add the `keys` store.

### Step 4: Transparent Socket Middlewares & Message Encryption Hooks
* Hook into `sendMessage` in [MessageInput.jsx](file:///c:/olh-zenchat/client/src/components/chat/MessageInput.jsx) to perform client-side encryption.
* Hook into message hydration and websocket receiver inside [SocketContext.jsx](file:///c:/olh-zenchat/client/src/context/SocketContext.jsx) to perform silent, high-performance background decryption before saving to IndexedDB.
