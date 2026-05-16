# ZenChat Feature Implementation Plan

## Core Philosophy & Aesthetic: "The Human Connection"
*ZenChat is not just a utility; it is a digital space designed to respect the human experience. Every feature must prioritize emotional resonance over raw efficiency. We build for the human spectrum - using natural physics, meaningful friction, and melancholic beauty to make every connection feel alive, personal, and deeply human.*

---

This document outlines the technical architecture and step-by-step implementation plan for the next set of premium features designed to make ZenChat unique.

---

## 1. Time-Capsule Messages
**Concept:** Messages that are securely locked until a specific future date and time.

### Technical Plan
**Database (`models/Message.js`)**
- Add an `unlockAt` (Date) field to the schema.

**Server-Side (`handlers.js` & Routes)**
- When fetching messages, the server checks if `unlockAt > Date.now()`.
- If true, the server **strips the actual `content` and `mediaUrl`** from the payload before sending it to the client (ensuring it cannot be bypassed by looking at browser network tools).
- Set up a lightweight server-side Cron job (e.g., using `node-cron`) or a delayed Redis job that checks for capsules that just expired.
- When `unlockAt` passes, the server emits a `capsule_unlocked` socket event containing the full message payload to the specific chat room.

**Client-Side (React UI)**
- `MessageBubble.jsx`: If `unlockAt` exists and is in the future, render a distinct "Locked Capsule" UI component.
- Implement a live countdown timer (`setInterval`) that updates the "Opens in X time" text.
- When the timer hits zero (or when the `capsule_unlocked` socket event is received), trigger a smooth unlocking animation and swap the component to reveal the text.

---

## 2. Zen Mode (Focus Mode)
**Concept:** A highly immersive, distraction-free environment that fades out history and focuses only on the current thought.

### Technical Plan
**State Management (`chatStore.js`)**
- Add a boolean state: `isZenMode: false`.
- Add toggle functions.

**Client-Side (React UI)**
- Add a minimalist "Zen" toggle icon in the chat header.
- **`ChatWindow.jsx` Changes:**
  - When `isZenMode` is true, apply a CSS class `zen-active` to the main container.
  - Instead of rendering the full `messages` array, filter it to **only render the last 1 or 2 messages**.
  - Hide the sidebar (if on desktop) and fade out the chat header to a subtle opacity (restored on hover).
- **CSS Animations:**
  - Use smooth `opacity` and `transform` transitions so the older messages beautifully blur and fade away into the background, rather than abruptly snapping out of existence.

---

## 3. "Burn-on-Read" Secure Vault
**Concept:** Ultimate security for passwords/API keys. Disintegrates the exact millisecond it is viewed.

### Technical Plan
**Database (`models/Message.js`)**
- Add an `isVaultSecret: { type: Boolean, default: false }` field.

**Server-Side (`handlers.js`)**
- Vault messages are stored normally but are flagged.
- Create a new socket listener: `unlock_vault`.
- When the receiver triggers this event, the server:
  1. Fetches the message content.
  2. **Immediately hard-deletes** the message from the database.
  3. Sends the raw content back to the receiver via a direct socket response callback.

**Client-Side (React UI)**
- `MessageInput.jsx`: Add a lock/vault toggle next to the disappearing message dropdown.
- `MessageBubble.jsx`: If `isVaultSecret`, render a blurred/locked card.
- **Interaction:**
  - When the receiver taps the card, emit `unlock_vault`.
  - Upon receiving the response, show the text for exactly 5 seconds (or auto-copy to clipboard).
  - After 5 seconds, trigger a CSS/Canvas "dust/ash" particle animation and fully remove the component from the DOM and local store.

---

## 4. The Modern "Nudge" (Haptic Ping)
**Concept:** A visceral, physical way to grab a user's attention using haptics and UI motion.

### Technical Plan
**Server-Side (`handlers.js`)**
- Add a new socket event: `send_nudge`.
- Implement basic **Rate Limiting** (e.g., using a Map or Redis to ensure a user can only send 1 nudge per minute per chat, preventing spam).
- Emit `receive_nudge` to the specific user's sockets.

**Client-Side (React UI)**
- **UI Interaction:** Add a small "Ping" or "Wave" icon near the text input or header.
- **Handling the Event:**
  - When `receive_nudge` is fired, execute the browser Haptics API if available: `if (navigator.vibrate) navigator.vibrate([200, 100, 200]);`.
  - Apply a temporary CSS class `.nudge-shake` to the main application container.
- **CSS:**
  - Create an `@keyframes shake` animation that rapidly translates the X and Y axis by 2-5 pixels for 0.4 seconds.
  - Play a very soft, organic UI sound (using `Audio` API) if the user hasn't muted the tab.

---

## 5. Smart Client-Side Media Compression
**Concept:** Aggressively compress images/videos locally before uploading to save mobile data and cloud storage costs.

### Technical Plan
**Client-Side (React UI & Utilities)**
- Implement an image compression utility using `browser-image-compression` or native Canvas API.
- Intercept the file upload process in `MessageInput.jsx` before sending to Cloudinary.
- **Workflow:** 
  1. User selects a high-res photo.
  2. Local utility resizes/compresses it to ~300KB (maintaining visual quality for mobile screens).
  3. The compressed blob is uploaded to Cloudinary.
- This ensures instant uploads and massive data savings for the user.

---

## 6. Offline-First Bulletproof Queuing
**Concept:** Allow users to chat flawlessly during network drops, syncing instantly when connection returns.

### Technical Plan
**State Management & IndexedDB (`chatStore.js` / `zenDB.js`)**
- Create a dedicated `outbox` table in IndexedDB for pending actions (messages, reactions, deletes).
- When a user sends a message while offline (or if the socket fails), save the action to the local `outbox` and render the message optimistically with a "pending/clock" status.
**Background Syncing**
- Add an event listener `window.addEventListener('online', flushOutbox)`.
- When connection is restored, iterate through the `outbox` and emit the pending socket events.
- On successful server ack, remove the item from `outbox` and update the message status to "sent".

---

## 7. Auto-Purging Local Cache (Storage Conservation)
**Concept:** Prevent the PWA from bloating phone storage by automatically clearing old cached media.

### Technical Plan
**Local Storage Management (`zenDB.js`)**
- Add a timestamp to cached media entries in IndexedDB.
- Create a utility function `purgeOldMedia()` that runs periodically (e.g., on app startup).
- **Workflow:**
  1. Scan IndexedDB for media items older than 7 days.
  2. Delete the heavy blobs from local storage.
  3. Replace the local reference with a tiny, heavily blurred placeholder (generated during the initial upload/fetch).
**Client-Side (React UI)**
- `MessageBubble.jsx`: If a media item has been purged locally, display the blurred placeholder with a "Tap to Download" icon, fetching it from Cloudinary only when explicitly requested.

---

## 8. Adaptive Bottom Sheets
**Concept:** Modals that act as native slide-up sheets on mobile but standard centered modals on desktop.

### Technical Plan
**Client-Side (React UI)**
- Create a reusable `AdaptiveModal` component.
- **Mobile Logic:** Use `fixed bottom-0 left-0 w-full` styling. Implement a "drag handle" at the top. Use `framer-motion` to handle the `drag="y"` gesture so users can flick the menu down to close it.
- **Desktop Logic:** Use a standard `max-w-md` centered overlay.
- **Integration:** Migrate `InviteModal.jsx` and the message options menu to this new adaptive pattern.

---

## 9. PWA App Badging & Shortcuts
**Concept:** Show unread counts on the home screen icon and add long-press quick actions.

### Technical Plan
**App Badging (`SocketContext.jsx`)**
- Use the `navigator.setAppBadge(count)` API.
- **Logic:** Whenever an incoming message is received and the app is not in the foreground, calculate the total unread count from the `chatStore` and update the badge. Clear it with `navigator.clearAppBadge()` when the user opens the app.
**App Shortcuts (`public/manifest.json`)**
- Define `shortcuts` in the PWA manifest.
- **Shortcuts:** "New Chat", "Check Moments", and "Invite Friends".
- These will appear when the user long-presses the app icon on Android/iOS.

---

## 10. Site-Native Pull-to-Refresh (Snapchat Style)
**Concept:** A custom, branded refresh animation that feels deeply integrated into the app.

### Technical Plan
**Client-Side (React UI - `Sidebar.jsx`)**
- Disable browser default pull-to-refresh: `overscroll-behavior-y: contain`.
- **Implementation:**
  1. Track `touchstart` and `touchmove` on the chat list.
  2. If at scroll position 0, apply a `translateY` to the list as the user pulls down.
  3. Render a custom SVG animation (e.g., a glowing ZenChat logo that fills up) in the gap created.
  4. Once a threshold (e.g., 80px) is met, trigger `fetchChats()` and `fetchMoments()`.
  5. Play a smooth snap-back animation once data is loaded.

---

## 11. Overscroll Bounce Physics
**Concept:** Add the "rubber-band" effect to lists for a premium native feel.

### Technical Plan
**Client-Side (React UI)**
- Use `framer-motion`'s `motion.div` for chat and message lists.
- Set `drag="y"` with very tight constraints and high `dragElastic`.
- This allows the list to "bounce" when the user hits the top or bottom of the scroll, rather than just hitting a hard wall. This is a subtle but massive indicator of a native-feeling app.
