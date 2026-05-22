# Implementation Plan - Offline-First Bulletproof Queuing

Implement an offline-first bulletproof messaging and sync queue in ZenChat. This ensures immediate optimistic rendering in the UI with a pending status icon, robust offline queuing in IndexedDB, secure on-reconnection E2EE encryption, and seamless message ID reconciliation with server acknowledgements.

## User Review Required

> [!IMPORTANT]
> **E2EE Encryption at Sync Time:**
> Since public key retrieval requests to `/auth/users/:id/public-key` require active network connectivity, messages queued while completely offline are stored locally in IndexedDB as plaintext. 
> To guarantee E2EE integrity, these queued text messages will be transparently encrypted **during the outbox flush sequence** immediately after connection is restored, before they are emitted to the socket server. This preserves the security model while allowing offline messaging.

---

## Proposed Changes

### 1. Database & Outbox Layer
Ensure offline messages are persisted with all relevant fields (including the client-side correlation ID `cid`).

#### [MODIFY] [zenDB.js](file:///d:/olh-zenchat/client/src/db/zenDB.js)
No structural database schema modifications are required since `db.version(5)` already includes an `outbox` table mapped to `++id, chatId, createdAt`. We will ensure the helper methods are correctly aligned with the state store.

---

### 2. Socket & Reconnection Layer
Implement connection monitoring, concurrency-safe outbox flushing, E2EE encryption during flush, and socket dispatch.

#### [MODIFY] [SocketContext.jsx](file:///d:/olh-zenchat/client/src/context/SocketContext.jsx)
- Introduce a concurrency lock `isFlushingRef = useRef(false)` to prevent duplicate drains and race conditions during simultaneous socket connection and window online events.
- Consolidate socket `connect` and window `online` hooks to call a single unified `flushOutbox` function.
- In `flushOutbox`, detect unsent plaintext text messages, resolve the other participant's ID (by matching the `chatId` against the store's loaded chat array), fetch public keys via `axiosInstance`, and transparently encrypt the message content via E2EE before emitting `send_message`.

---

### 3. State Management Layer
Handle optimistic state updates, client-side deduplication, and database cleanup upon server acknowledgement.

#### [MODIFY] [chatStore.js](file:///d:/olh-zenchat/client/src/stores/chatStore.js)
`addMessage` already supports matching optimistic temporary messages by client ID (`cid`), deleting the temp record from IndexedDB `messages`, and replacing it with the server-assigned message and status. No structural changes are required here, but we will review and ensure absolute consistency.

---

### 4. UI Layer
Align with ZenChat's beautiful signature message status mechanic instead of adding redundant, cluttered checkmarks or clock icons next to the timestamp.

#### [MODIFY] [MessageBubble.jsx](file:///d:/olh-zenchat/client/src/components/chat/MessageBubble.jsx)
- **Do not add any checkmark or clock icons next to the timestamp.** Adding these would conflict with the premium, clutter-free aesthetics of ZenChat.
- **Preserve the background-color and shadow-based status indicators:** Let the outgoing bubble background and shadow communicate the status:
  - `status === "sending"`: Displays a grey-translucent background with a dashed border (`.mine.status-sending`).
  - `status === "sent"`: Displays a solid slate-grey background (`.mine.status-sent`).
  - `status === "delivered"`: Displays a royal blue background with a blue glow shadow (`.mine.status-delivered`).
  - `status === "read"` or `"seen"`: Displays a gorgeous teal background with a teal glow shadow (`.mine.status-seen`).
- Keep the existing file upload progress overlay (circular progress for media uploads, linear bar for texts) intact so that active uploads under `status === "sending"` display the accurate progress.

---

## Verification Plan

### Manual Verification
1. **Offline Queueing Simulation:**
   - Turn off Wi-Fi or toggle DevTools Network to "Offline" mode.
   - Type and send a message.
   - Verify it appears immediately in the chat area with a grey-translucent background and dashed border indicating it is in a pending/sending status.
2. **Offline Page Reload Resilience:**
   - With DevTools still set to Offline, refresh the page.
   - Navigate to the active chat and verify that the optimistic pending message is successfully loaded from IndexedDB and still displays the grey-translucent dashed background.
3. **Reconnection & Sync:**
   - Toggle DevTools Network back to "Online" mode.
   - Verify the outbox flushes instantly.
   - Verify the message border turns solid and the background updates instantly to solid slate grey ("sent"), then royal blue ("delivered") and teal ("seen") as the socket server delivers acknowledgements.
   - Verify no duplicate message bubbles appear in the chat.

