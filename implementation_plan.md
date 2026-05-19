# Implementation Plan - ZenChat Premium Features & Core Fixes

This plan outlines the implementation of four major engagement/security features along with fixes for critical UI bugs and presence tracking.

## User Review Required

> [!IMPORTANT]
> **ZenVault Security Disclaimer:**
> ZenVault is a local-only encrypted vault using the browser's Web Crypto API (AES-GCM 256-bit). The encryption keys are derived dynamically from a Master Passphrase and never sent to the server. If a user loses their passphrase, their local vault files are permanently unrecoverable. 

> [!WARNING]
> **Zen Whispers Fallback Proximity Detection:**
> Because the browser's native `DeviceProximityEvent` is deprecated or unavailable on many mobile platforms, we will use the `DeviceOrientationEvent` (monitoring screen tilt angle) as a fallback to trigger Whisper Mode (Private ear-playback level and volume lowering) when the user lifts the phone to their ear.

---

## Proposed Changes

### Component 1: Core Bug Fixes

#### [MODIFY] [handlers.js](file:///c:/olh-zenchat/server/socket/handlers.js)
- Fix the presence detection bug by passing the `io` instance to `broadcastUserStatus` inside the socket `disconnect` callback (lines 189 and 201). This will ensure offline status is successfully broadcast to all users when a client disconnects.

#### [MODIFY] [ProfileModal.jsx](file:///c:/olh-zenchat/client/src/components/ui/ProfileModal.jsx)
- **Restricted 2FA Options:** If `user.email` exists (email signup), display only Phone SMS OTP as the 2FA option. If `user.phoneNumber` exists and `!user.email` (phone signup), display only Email Verification as the 2FA option.
- **Email Input Validation:** Add an email input field when setting up Email 2FA (for phone signups without an email in their profile) so that they can specify and verify their email. Ensure input fields (email or phone) are validated and required before the "Send Verification Code" button is enabled.
- **Button Alignment:** Fix the alignment of the "Cancel" and "Verify" buttons on the manual OTP entry screen to render centered and properly padded on mobile viewports.
- **SP-OP Toggle Synchronization:** Ensure the `#SP-OP` toggle state renders correctly and updates in real-time when the network speed auto-check changes the state.

#### [MODIFY] [auth.js](file:///c:/olh-zenchat/server/routes/auth.js)
- Update the `/2fa/setup/request` and `/2fa/setup/verify` routes to accept `email` in the request body. If setting up Email 2FA, validate the email format and uniqueness, and update the user's email in the database upon successful verification.

---

### Component 2: ZenVault (Secure Local Safe)

#### [MODIFY] [zenDB.js](file:///c:/olh-zenchat/client/src/db/zenDB.js)
- Increment the Dexie database schema to version 5 and add a `vault` store to save secure document metadata and encrypted payloads:
  ```javascript
  db.version(5).stores({
      chats: "_id, updatedAt, lastMessage._id",
      messages: "_id, chatId, createdAt, senderId",
      settings: "key",
      outbox: "++id, chatId, createdAt",
      keys: "key",
      vault: "id, name, type, size, date",
  });
  ```

#### [NEW] [ZenVaultModal.jsx](file:///c:/olh-zenchat/client/src/components/ui/ZenVaultModal.jsx)
- A highly polished, glassmorphic modal utilizing vanilla CSS.
- **Setup State:** Prompts users to define a Master Passphrase. Derives a key using `PBKDF2` and encrypts a verification token stored locally.
- **Access State:** Prompts users for their password, derives the AES-GCM 256-bit key, and decrypts the verification token.
- **Secure Storage:** Allows dragging/dropping files, encrypts them in-memory using Web Crypto, and saves the binary payload and IV in Dexie. Decrypts and previews files in-memory when tapped. Contains an immediate "Lock Safe" state resetter.

#### [MODIFY] [Sidebar.jsx](file:///c:/olh-zenchat/client/src/components/chat/Sidebar.jsx)
- Add the Vault lock button next to the Logout button in the header. Tapping it opens the `ZenVaultModal`.

---

### Component 3: Zen Whispers (Ambient Voice Messaging)

#### [MODIFY] [MessageInput.jsx](file:///c:/olh-zenchat/client/src/components/chat/MessageInput.jsx)
- Add a mic recording action sheet that lets users select an ambient sound overlay: "None", "Fireplace Warmth", or "Gentle Rain".
- Set up a Web Audio API graph (`AudioContext`) that mixes the microphone input with a procedurally synthesized ambient loop (pink noise + crackling spikes for fireplace; low-pass filtered white noise + volume modulation for rain).
- Send the mixed stream to `MediaRecorder`, compile the final blob, and upload it as a voice message of type `"voice"`.

#### [MODIFY] [MessageBubble.jsx](file:///c:/olh-zenchat/client/src/components/chat/MessageBubble.jsx)
- Listen to `deviceorientation` events when a voice message is playing.
- If the device tilt transitions to a vertical ear-listening posture (e.g., `beta > 75` and `|gamma| < 25`), lower the audio volume significantly, apply a lowpass filter, and hide standard background noise to ensure high-fidelity whispering directly to the ear.

---

### Component 4: Inner Circle Spatial Dashboard

#### [NEW] [InnerCircleCanvas.jsx](file:///c:/olh-zenchat/client/src/components/chat/InnerCircleCanvas.jsx)
- Renders an interactive spatial grid/canvas.
- Grabs the user's closest contacts (by filtering the `close_circle` tag, or fallback to all contacts).
- Renders contacts as glassmorphic circles floating and drifting dynamically using spring physics and wall collisions.
- Emits pulsing glow circles under typing contacts.
- Supports drag-and-drop mechanics. Dragging a contact sphere to the center of the canvas opens the direct message chat window immediately.

#### [MODIFY] [Sidebar.jsx](file:///c:/olh-zenchat/client/src/components/chat/Sidebar.jsx)
- Add an "Inner Circle" tab to the sidebar navigation (Recents | Contacts | Inner Circle).
- When selected, mount the `InnerCircleCanvas` inside the sidebar panel.

---

### Component 5: Zero-Payload Crisis Mode

#### [NEW] [packetCompressor.js](file:///c:/olh-zenchat/client/src/utils/packetCompressor.js)
- Maps websocket payloads to highly minimized key structures (e.g. `chatId` -> `c`, `content` -> `t`, `type` -> `y`, etc.) when `isLowBandwidth` is active, significantly lowering network packet overhead.

#### [MODIFY] [SocketContext.jsx](file:///c:/olh-zenchat/client/src/context/SocketContext.jsx)
- Integrate key mapping for outgoing and incoming websocket frames when in low bandwidth.

#### [MODIFY] [handlers.js](file:///c:/olh-zenchat/server/socket/handlers.js)
- Handle compressed incoming packets transparently, restoring them to full model keys prior to saving to database.

#### [MODIFY] [ChatWindow.jsx](file:///c:/olh-zenchat/client/src/components/chat/ChatWindow.jsx) / [MessageBubble.jsx](file:///c:/olh-zenchat/client/src/components/chat/MessageBubble.jsx)
- When `isLowBandwidth` is active, disable all fluid layout animations, transition triggers, and gradient blurred masks. Renders simple initials instead of avatar images.

---

## Verification Plan

### Automated & Manual Tests
- **Presence Broadcast:** Connect two browser windows as different users. Verify minimizing or locking screen transitions the user offline within 2 seconds, and broadcasts status properly now that `io` is supplied to `broadcastUserStatus`.
- **2FA Validation:** Attempt to set up 2FA for a user without email/phone, ensuring the send button is disabled until valid input is typed, and that verify/cancel buttons are perfectly aligned.
- **ZenVault Encryption:** Check IndexedDB records inside Chrome DevTools to verify files are stored as encrypted blobs and cannot be read without the passphrase.
- **Audio Mixing & Whispers:** Record an ambient voice message and review the uploaded waveform. Verify tilt transitions drop playback volume.
