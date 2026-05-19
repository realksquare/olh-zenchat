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
**Concept:** A highly immersive, distraction-free environment that fades out history and focuses only on the current thought, accompanied by a liquid circular background transition originating from the toggle button.

### Technical Plan
**State Management (`chatStore.js`)**
- Add `isZenMode: false` state.
- Add `toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode }))` action.

**Client-Side (React UI & Liquid Circular Reveal)**
- **Header Button:** Add a lotus or eye icon button in the header actions.
- **Circular Reveal Mechanism:**
  1. Capture click coordinates `(clientX, clientY)` on toggle.
  2. Render a dynamic circular reveal overlay element (`.zen-reveal-circle`) starting at `left: x`, `top: y` with `width: 0`, `height: 0`, `border-radius: 50%`.
  3. Animate the circle to scale up (`transform: translate(-50%, -50%) scale(R)`) where `R` is calculated using the container diagonal.
  4. Use a smooth transition (`transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)`) to simulate a liquid filling the space.
- **`ChatWindow.jsx` Layout Changes:**
  - When active, apply `.zen-active` to the chat window.
  - Filter visible messages to render **only the last 1 or 2 messages**.
  - Hide the sidebar and fade out the chat header (auto-restoring opacity on hover).
- **CSS Transitions:**
  - Apply CSS filters (`blur()`) and opacity transitions to old messages to fade them out smoothly.
  - Add a slow, pulsing breathing-halo glow to the background.
- **Cinematic First-Time Intro Sequence:**
  1. Store an intro flag `localStorage.getItem("zen_intro_shown")`.
  2. If the user toggles Zen Mode and the flag is absent:
     - Render a gorgeous, full-screen overlay `.zen-intro-overlay` with a rich dark absolute backdrop and radial gradient halos.
     - **10-Second Cinematic Timeline Choreography:**
       - **0s - 1s (The Awakening):** The absolute overlay fades in (`opacity: 1`). Warm, soft radial gradient halos grow in the background. A canvas initialized behind the text starts rendering tiny dust motes/light embers drifting slowly upwards.
       - **1s - 4.5s (The Void - Phase 1):** The first message *"Quiet the noise."* emerges at the center. It uses clean, wide-spaced caps typography (`font-weight: 300; letter-spacing: 0.35em`). It smoothly slides up out of a CSS `clip-path` mask boundary, transitioning from `filter: blur(12px); opacity: 0` to `filter: blur(0); opacity: 0.9` using a smooth ease-out curve.
       - **4.5s - 7.5s (The Mind - Phase 2):** The first message fades out and blurs away. The second message *"Embrace the thought."* is revealed in an elegant, italicized serif font (e.g. `'Playfair Display'`). Behind this text, a soft glowing organic blob/breathing halo slowly pulses.
       - **7.5s - 9.0s (The Union - Phase 3):** The second message fades out. A minimalist glowing Zen lotus logo emerges alongside the text *"ZEN MODE ACTIVE"*.
       - **9.0s - 10.0s (The Release):** The complete intro overlay smoothly scales up slightly and drops to `opacity: 0` using a `cubic-bezier(0.16, 1, 0.3, 1)` transition, seamlessly blending into the distraction-free chat window layout.
     - Add a tiny, minimalist outline button at the top-right (`.btn-skip-intro`) styled with high transparency (`background: transparent; border: 1px solid rgba(255,255,255,0.2)`) to allow bypassing the sequence instantly.
     - Auto-dismiss and transition into active Zen Mode after 10 seconds, setting `zen_intro_shown` to `"true"`.
     - **Procedural Ambient BGM & Sync:** 
       - Since audio/music assets are heavy and consume data, we will dynamically synthesize a deep, soothing **ambient singing-bowl drone** completely offline using the **Web Audio API** in `utils/audio.js` that is perfectly synced with the visual reveal.
       - *Synthesis & Sync Recipe:*
         1. **Phase 1: Initial Deep Focus (0s - 3s):** Trigger a low-frequency oscillator triad (110Hz, 165Hz, 220Hz) routed through a low-pass filter (cutoff ~250Hz). As the first text *"Quiet the noise."* fades in, the master gain will gradually swell (`linearRampToValueAtTime`) from 0 to 0.15 to mirror the visual emergence.
         2. **Phase 2: Harmonious Progression (3s - 7s):** As the second phrase *"Embrace the thought."* starts to slide out of the blur mask, we will trigger a soft, higher seventh chord overtone layer (330Hz and 440Hz sine waves) to create a gentle emotional lift, matching the text reveal velocity.
         3. **Phase 3: The Fade Out (7s - 10s):** As the motion poster titles fade away to prepare for the active focus space, the synth will gently ramp down its master gain to zero over 1.5 seconds (`linearRampToValueAtTime`) to gracefully fade out without abrupt clicks, syncing perfectly with the transition into Zen Mode.

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

## 5. Offline-First Bulletproof Queuing
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

## 6. Auto-Purging Local Cache (Storage Conservation)
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

## 7. Adaptive Bottom Sheets
**Concept:** Modals that act as native slide-up sheets on mobile but standard centered modals on desktop.

### Technical Plan
**Client-Side (React UI)**
- Create a reusable `AdaptiveModal` component.
- **Mobile Logic:** Use `fixed bottom-0 left-0 w-full` styling. Implement a "drag handle" at the top. Use `framer-motion` to handle the `drag="y"` gesture so users can flick the menu down to close it.
- **Desktop Logic:** Use a standard `max-w-md` centered overlay.
- **Integration:** Migrate `InviteModal.jsx` and the message options menu to this new adaptive pattern.

---

## 8. PWA App Badging & Shortcuts
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

## 9. Site-Native Pull-to-Refresh (Snapchat Style)
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

## 10. Overscroll Bounce Physics
**Concept:** Add the "rubber-band" effect to lists for a premium native feel.

### Technical Plan
**Client-Side (React UI)**
- Use `framer-motion`'s `motion.div` for chat and message lists.
- Set `drag="y"` with very tight constraints and high `dragElastic`.
- This allows the list to "bounce" when the user hits the top or bottom of the scroll, rather than just hitting a hard wall. This is a subtle but massive indicator of a native-feeling app.
