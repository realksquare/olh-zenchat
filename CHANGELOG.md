# ZenChat - Changelog

> Tracked changelog for ZenChat repository.
> Log every push here: what changed, what was added, what was fixed, and any important notes.

---

## Push Log

---

### [cf5de0c] - 2026-10-25 - `feat-24h-ephemeral-burner-bridge-links`

**Type:** Feature / Ephemeral E2EE Sessions
**Files affected:** `server/models/BurnerBridge.js`, `server/models/BurnerMessage.js`, `server/routes/burner.js`, `server/socket/burnerHandlers.js`, `server/index.js`, `client/src/utils/burnerCrypto.js`, `client/src/components/ui/BurnerBridgeModal.jsx`, `client/src/pages/BurnerChatPage.jsx`, `client/src/components/chat/Sidebar.jsx`, `client/src/App.jsx`, `client/src/index.css`

| Date & Day | Time (IST) | Change / Fix / Addition / Removal Done | Antigravity Version | Agent Model Name |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-25 (Sunday) | 08:05 PM | **Feature:** Implemented 24-Hour Ephemeral Burner Bridge Links with Zero-Knowledge client-side AES-256-GCM encryption, zero-login guest chat at `/burner/:token#key`, real-time Socket.IO room messaging, MongoDB TTL auto-purge, and instant self-destruct incineration. | Antigravity 2.0 | Gemini 3.8 Flash |

**Changes:**
- Created `BurnerBridge` and `BurnerMessage` Mongoose models with automated MongoDB TTL index expiration.
- Built `/api/burner` REST endpoints (`create`, `preview`, `join`, `messages`, `burn`, `my-bridges`) with guest JWT issuance and creator authorization.
- Added `/burner` Socket.IO namespace supporting real-time end-to-end messaging, live typing status, peer join announcements, and instant broadcast incineration.
- Implemented `burnerCrypto.js` zero-knowledge Web Crypto AES-256-GCM symmetric encryption: keys are stored in the URL `#hash` fragment and never transmitted to the server.
- Built `BurnerBridgeModal.jsx` in the client with duration selector (1h, 8h, 24h), message limit controls, 1-tap link copying, and active bridge monitoring.
- Built standalone zero-login `BurnerChatPage.jsx` at `/burner/:token` with live self-destruct countdown, real-time message stream, typing indicators, and confirmation-protected manual burn.
- Integrated Burner Bridge entry points into `Sidebar.jsx` footer and mobile drawer menu, with code-splitting via `React.lazy` and `Suspense`.

---

### [b6c0c7d] - 2026-10-25 - `feat-in-chat-search-and-bundle-code-splitting`

**Type:** Feature / Performance Optimization
**Files affected:** `client/src/components/chat/ChatWindow.jsx`, `client/src/components/chat/DecryptedText.jsx`, `client/src/components/chat/MessageBubble.jsx`, `client/src/components/chat/Sidebar.jsx`, `client/src/index.css`

| Date & Day | Time (IST) | Change / Fix / Addition / Removal Done | Antigravity Version | Agent Model Name |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-25 (Sunday) | 06:45 PM | **Feature & Performance:** Added client-side in-chat message search with match counter, keyboard navigation (Enter / Shift+Enter / Esc), and animated highlight pulse; implemented modal code-splitting with React.lazy and Suspense, reducing initial bundle by 56% (523 KB down to 227 KB). | Antigravity 2.0 | Gemini 3.8 Flash |

**Changes:**
- Added client-side in-chat message search in `ChatWindow.jsx` with search bar toggle, match indexing, next/previous navigation buttons, and match count indicator.
- Updated `DecryptedText.jsx` with substring match highlighting (`<mark className="in-chat-search-highlight">`) without affecting embedded links or decryption effects.
- Added smooth target scroll-into-view and active target pulse effect in `MessageBubble.jsx` and `index.css`.
- Code-split heavy modals in `Sidebar.jsx` and `ChatWindow.jsx` (`ProfileModal`, `ZenVoicePortal`, `ZenVaultModal`, `AdminPanel`, `MomentCreator`, `MomentViewer`, `YourTimeDashboard`, `InviteModal`, `ThemeSwitcherModal`, `FAQModal`, `E2EEInfoModal`, `UserCardModal`, `MediaViewerModal`, `DocViewerModal`, `ForwardModal`) with `lazy` and `Suspense`.
- Slashed initial `HomePage` bundle from 523 KB (gzip 118 KB) down to 227 KB (gzip 58 KB), speeding up initial paint and mobile launch significantly.

---

### [3629f28] - 2026-10-18 - `fix-site-wide-fast-spinner-animation-speeds`

**Type:** Bugfix / UI Polish
**Files affected:** `client/src/index.css`, `client/src/components/chat/MessageBubble.jsx`, `client/src/components/chat/VoiceMessageBubble.jsx`, `client/src/components/chat/MomentViewer.jsx`, `client/src/components/ui/InviteModal.jsx`, `client/src/components/ui/SharePulseModal.jsx`, `client/src/components/layout/NotificationPrompt.jsx`

| Date & Day | Time (IST) | Change / Fix / Addition / Removal Done | Antigravity Version | Agent Model Name |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-18 (Sunday) | 07:25 PM | **Fix / Style:** Slowed down all site-wide fast loading spinners: `.loader-sm` 0.6s to 1.2s, `.aura-loader` 0.8s to 1.2s, `.ptr-arc-spin` 0.7s to 1.1s, and all inline `aura-spin 0.8s`/`spin 0.8-0.9s` in JSX files to 1.2s. | Antigravity 2.0 | Claude Sonnet |

**Changes:**
- Unified all loading spinner animation durations to a consistent 1.1s-1.2s range site-wide.
- Fixed fast spinner durations in CSS classes (`.loader-sm`, `.aura-loader`, `.ptr-arc-spin`) in `index.css`.
- Fixed inline `animation` style props in `MessageBubble.jsx`, `VoiceMessageBubble.jsx`, `MomentViewer.jsx`, `InviteModal.jsx`, `SharePulseModal.jsx`, and `NotificationPrompt.jsx`.

---

### [eafde74] - 2026-10-18 - `fix-zen-oled-adaptive-calm-border-glow-for-media-messages`

**Type:** Bugfix / UI Polish
**Files affected:** `client/src/index.css`

| Date & Day | Time (IST) | Change / Fix / Addition / Removal Done | Antigravity Version | Agent Model Name |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-18 (Sunday) | 02:25 PM | **Fix / Style:** Implemented adaptive calm border glow: 60s for standard text and 90s for large media/image bubbles on desktop (14s for media on mobile) to eliminate fast perimeter whipping. | Antigravity 2.0 | Gemini 3.8 Flash |

**Changes:**
- Decoupled media message bubbles (`.message-bubble.mine:has(.message-media-wrap)`) from regular text bubbles, giving them a 90s rotation duration to prevent high linear velocity on large 1000px+ media elements.
- Slowed standard message bubbles on desktop to a calm 60s rotation.
- Added proportionate mobile media bubble duration (14s) while maintaining snappy 6s for compact text bubbles.

---

### [4b54538] - 2026-10-18 - `fix-zen-oled-responsive-border-beam-animation-speeds`

**Type:** Bugfix / UI Style
**Files affected:** `client/src/index.css`

| Date & Day | Time (IST) | Change / Fix / Addition / Removal Done | Antigravity Version | Agent Model Name |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-18 (Sunday) | 01:34 PM | **Fix / Style:** Tuned `#ZenOLED` message bubble status border beam animation speed - slowed down on desktop to 28s (calm and subtle) and sped up on mobile to 6s (responsive and visible). | Antigravity 2.0 | Gemini 3.8 Flash |

**Changes:**
- Adjusted `.message-bubble.mine::before` border animation on desktop from 18s to 28s to eliminate visually distracting high-speed rotation on wide screens.
- Adjusted mobile breakpoint (`max-width: 768px`) animation duration from 10s to 6s so the glowing border beam travels around smaller phone bubbles at an engaging, responsive pace.

---

### [86a1e3b] - 2026-10-18 - `refactor-chunk-chat-components-and-cleanup-redundant-scripts`

**Type:** Refactor / Cleanup / Maintenance
**Files affected:** `client/src/components/chat/ChatWindow.jsx`, `client/src/components/chat/ChatWindowUtils.jsx`, `client/src/components/chat/MessageBubble.jsx`, `client/src/components/chat/MessageBubbleUtils.jsx`, `zenchat_ai_instructions.md`, `CHANGELOG.md`, `.gitignore`, redundant script files

| Date & Day | Time (IST) | Change / Fix / Addition / Removal Done | Antigravity Version | Agent Model Name |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-18 (Sunday) | 12:58 PM | **Refactor / Chunking:** Modularized `ChatWindow.jsx` (~535 lines offloaded) by extracting canvas animations, banner, scroll buttons, and utilities into `ChatWindowUtils.jsx`. | Antigravity 2.0 | Gemini 3.8 Flash |
| 2026-10-18 (Sunday) | 12:58 PM | **Refactor / Chunking:** Modularized `MessageBubble.jsx` (~153 lines offloaded) by extracting SVG reaction icons and file helper functions into `MessageBubbleUtils.jsx`. | Antigravity 2.0 | Gemini 3.8 Flash |
| 2026-10-18 (Sunday) | 12:58 PM | **Removal:** Removed redundant one-off scripts (`client/replace_colors.cjs`, `client/replace_css_backgrounds.cjs`, `client/replace_jsx.js`, `client/replace_text.cjs`, `scripts/clean_comments.js`). | Antigravity 2.0 | Gemini 3.8 Flash |
| 2026-10-18 (Sunday) | 12:58 PM | **Removal:** Removed leftover binary test file (`client/test.bin`). | Antigravity 2.0 | Gemini 3.8 Flash |
| 2026-10-18 (Sunday) | 12:58 PM | **Addition / Sync:** Restored and tracked `CHANGELOG.md` in repository, added root `.gitignore`, and updated `zenchat_ai_instructions.md`. | Antigravity 2.0 | Gemini 3.8 Flash |

**Changes:**
- Chunked large UI components (`ChatWindow` and `MessageBubble`) to prevent complexity bottlenecks, isolating helpers and canvas effects into dedicated utility modules.
- Preserved all runtime behavior and verified production build with `npm run build` (vite build passed with zero errors).
- Cleaned up obsolete maintenance scripts and test artifacts.
- Synchronized repository instructions and changelog tracking across all future development clones.

---

### [757b324] - 2026-08-16 - `feat-suspension-email-notifications-and-contact-admin-modal`

**Type:** Feature
**Files affected:** `server/utils/mailService.js`, `client/src/components/ui/AdminPanel.jsx`, auth routes
**Changes:**
- Added email notification system to alert suspended users about their account status.
- Added "Contact Admin" modal so suspended users can appeal/reach out from within the app.

---

### [dc08a71] - 2026-08-16 - `fix-delete-for-me-functionality-and-audiocontext-autoplay-warnings`

**Type:** Bugfix
**Files affected:** `client/src/components/chat/MessageBubble.jsx`, `client/src/utils/audio.js`
**Changes:**
- Fixed "Delete for Me" functionality that was not working correctly.
- Suppressed AudioContext autoplay warnings by properly handling audio context resumption on user gesture.

---

### [36acf55] - 2026-08-09 - `fix-authstore-persistence-partialize`

**Type:** Bugfix
**Files affected:** `client/src/stores/authStore.js`
**Changes:**
- Fixed Zustand partialize config so only correct state slices are persisted to localStorage, preventing stale auth state after logout.

---

### [8547019] - 2026-08-09 - `fix-stuck-signing-in-button-clear-stale-isLoading-on-login-mount`

**Type:** Bugfix
**Files affected:** `client/src/pages/LoginPage.jsx`, `client/src/stores/authStore.js`
**Changes:**
- Fixed "Signing in..." button permanently stuck after a failed/interrupted login attempt.
- isLoading is now reset to false on component mount to clear stale state.

---

### [f5c7047] - 2026-08-09 - `fix-production-backend-fallback-and-vercel-proxy-rewrites`

**Type:** Bugfix / Infra
**Files affected:** `client/vercel.json`, `client/src/utils/axios.js`
**Changes:**
- Fixed production backend URL fallback so the app correctly hits the Render backend when deployed on Vercel.
- Updated Vercel proxy rewrites to correctly handle API and socket routes.

---

### [f7cb235] - 2026-07-18 - `fix(zenvoice): auto-join and navigate to invited private room`

**Type:** Bugfix
**Files affected:** `client/src/components/zenvoice/ZenVoiceRoomBrowser.jsx`, `client/src/pages/ZenVoiceInvitePage.jsx`
**Changes:**
- Fixed invite link flow - clicking an invite link now auto-joins the private room and navigates directly into it.

---

### [d439e7d] - 2026-07-13 - `feat(zenvoice): update account prompt UI and complete moderation features`

**Type:** Feature / Style
**Files affected:** `client/src/components/zenvoice/ZenVoiceAccountPrompt.jsx`, server zenvoice routes
**Changes:**
- Redesigned ZenVoice account prompt UI.
- Removed emojis from UI per design guidelines.
- Completed the full moderation feature set (restrict, blur, red card system).

---

### [cdf8459] - 2026-07-12 - `feat(zenvoice): immediate registration, verification settings, deactivation, verified-only rooms`

**Type:** Feature
**Files affected:** `client/src/components/zenvoice/ZenVoiceVerifyModal.jsx`, `client/src/components/ui/ProfileModal.jsx`, `server/routes/zenVoice.js`
**Changes:**
- Added support for immediate registration flow in ZenVoice.
- Verification settings added to the main ProfileModal.
- ZenVoice account deactivation now supported.
- Room owners can now lock rooms to verified-only participants.

---

### [a4879b2] - 2026-07-12 - `feat(subscription): granular room-specific push notification subscriptions`

**Type:** Feature
**Files affected:** `client/src/stores/zenVoiceStore.js`, `client/src/components/zenvoice/ZenVoiceRoom.jsx`, socket handlers
**Changes:**
- Implemented full granular push notification flow for ZenVoice rooms.
- Users can subscribe/unsubscribe to notifications for specific pseudonyms within a room.
- Socket event integration for real-time subscription state updates.

---

### [cea22e3] - 2026-07-11 - `feat(zenvoice): full-page switch, profile options, interactive heatmap`

**Type:** Feature
**Files affected:** `client/src/components/zenvoice/ZenVoiceRoomBrowser.jsx`, `client/src/components/layout/ConnectionHeatmap.jsx`
**Changes:**
- Implemented full-page switch animation when entering/leaving ZenVoice.
- Added profile options in ZenVoice room context.
- Implemented the interactive connection heatmap showing activity patterns.
- Fixed various player crashes.

---

### [7c32b16] - 2026-07-10 - `Fix ZenVoice selection mode crash, restrict official room creation to admins, 2FA email pooling`

**Type:** Bugfix / Feature
**Files affected:** `client/src/components/zenvoice/ZenVoiceRoom.jsx`, `server/utils/mailService.js`
**Changes:**
- Fixed ReferenceError crash when entering ZenVoice message selection mode.
- Restricted official room creation to admin accounts only, with separate UI header buttons.
- Resolved 2FA email delay bug by implementing SMTP connection pooling.

---

### [24621a9] - 2026-07-07 - `Implement reply, edit, forward, delete in ZenVoiceRoom`

**Type:** Feature
**Files affected:** `client/src/components/zenvoice/ZenVoiceRoom.jsx`
**Changes:**
- Full message action suite implemented in ZenVoice: reply, edit, forward, delete (for me / for everyone).
- Removed own message avatar spacer for cleaner layout.

---

> _Entries above this line are backfilled from git history._
> _From here onwards, log every push manually BEFORE running git push origin main._

---

## How to Use

Before every `git push origin main`, add an entry at the TOP of the Push Log section using this format:

```
### [<short-hash>] - YYYY-MM-DD - `<commit subject>`

**Type:** Feature | Bugfix | Style | Refactor | Infra | Chore
**Files affected:** `path/to/file.js`, `path/to/other.jsx`
**Changes:**
- What was done.
- Another change if needed.
**Notes:** (optional) Caveats, known issues, or follow-ups.
```

Get the short hash after committing with: git log --oneline -1
