# ZenChat PWA Architecture & Feature Reference

This document outlines the features, UI components, state management, and database models of the existing Vanilla Node/React ZenChat PWA. Use this as a functional specification and context guide when rebuilding the application in React Native + Elixir (Phoenix).

## 1. Core Feature Set

ZenChat is a modern, offline-capable, real-time communication platform. Its primary features include:

*   **Real-time Messaging**: 1-on-1 and Group chats. Supports text, image, voice, and video payloads.
*   **Message Status Lifecycle**: Tracks message states (`sent`, `delivered`, `read`).
*   **Advanced Message Actions**: Reply-to, Edit message, "Delete for Everyone" / "Delete for Me", and Star/Favorite messages.
*   **Privacy Features**: "View Once" media support.
*   **Offline-First & Syncing**: Uses a client ID (`cid`) to track messages generated offline, queuing them in IndexedDB, and syncing them with the server (via Socket.io/REST) upon reconnection.
*   **"Moments" (Stories)**: A 24-hour ephemeral status system. Users can post Text, Images, Videos, or Music moments. Tracks who viewed the moment.
*   **Music Integration**: Ability to attach specific tracks (title, artist, preview URL, cover, timestamp) to Moments.
*   **Admin Tools**: Dedicated dashboard for user management and system monitoring.
*   **PWA Capabilities**: Install prompts, offline caching (Service Workers), and Web Push Notifications.

---

## 2. Frontend Architecture (React + Vite)

The frontend is highly modularized, which will map well to React Native.

### State Management (Zustand)
Global state is split logically into three main stores:
*   `authStore.js`: Handles JWT tokens, current user profile, and authentication state.
*   `chatStore.js`: Manages active chats, message histories, typing indicators, and socket synchronization.
*   `momentStore.js`: Manages the fetching, creation, and viewing state of ephemeral moments.

### Offline Database
*   `db/zenDB.js`: Wraps IndexedDB. Used primarily as an "Outbox" for messages sent while offline, and for caching recent chat histories.

### Key UI Component Breakdown
*   **Chat Core**: `ChatCard`, `ChatWindow`, `MessageBubble`, `MessageInput`, `Sidebar`.
*   **Moments Core**: `MomentCreator` (UI for building a status), `MomentViewer` (Story progression UI), `MomentsRow` (The horizontal avatar list at the top of the chat list).
*   **Specific Features**: `DecryptedText` (visual flair), `MusicSearch` (API integration for music moments), `TypingIndicator`.
*   **Modals & Overlays**: `ProfileModal`, `UserCardModal` (viewing other users), `AdminPanel`, `LoadingOverlay`, `SplashScreen`.
*   **PWA Specifics**: `InstallPWA` (A2HS logic) and `NotificationPrompt`.

---

## 3. Database Schema (MongoDB -> Target: PostgreSQL)

When migrating to Elixir (Ecto/PostgreSQL), you will need to map these NoSQL paradigms into relational tables. Here are the critical shapes of the existing Mongoose models:

### Message Model
*   `chatId` (Ref: Chat)
*   `senderId` (Ref: User)
*   `content` (String)
*   `type` (Enum: "text", "image", "voice", "video")
*   `status` (Enum: "sent", "delivered", "read")
*   `mediaUrl` (String)
*   `replyTo` (Ref: Message, self-referential)
*   `isEdited` (Boolean), `editedAt` (Date)
*   `deletedForEveryone` (Boolean)
*   `deletedFor` (Array of User Refs)
*   `starredBy` (Array of User Refs)
*   `isViewOnce` (Boolean), `viewedBy` (Array of User Refs)
*   `cid` (String) - **Crucial for offline sync (Client ID)**

### Moment Model (Stories)
*   `userId` (Ref: User)
*   `type` (Enum: "text", "image", "video", "music")
*   `content` (String)
*   `mediaUrl` (String)
*   `music` (Embedded Object: `title`, `artist`, `previewUrl`, `coverUrl`, `duration`, `startTime`)
*   `viewedBy` (Array of Objects containing `userId` and `at` timestamp)
*   `createdAt` (Date) - **Has a 24-hour TTL (Time To Live) index in MongoDB.**

---

## 4. Key Migration Considerations for React Native & Elixir

1.  **The `cid` Concept**: Keep the Client-Generated ID (`cid`) concept in React Native. Use `uuid` on the mobile device to create messages locally in SQLite/WatermelonDB, push them via Phoenix Channels, and reconcile the server ID response based on the `cid`.
2.  **Moments TTL**: PostgreSQL doesn't have a native "TTL Index" like MongoDB. You will need to write an Elixir GenServer or Oban background job to clean up Moments older than 24 hours.
3.  **JSONB for Music**: In Ecto (PostgreSQL), the embedded `music` object on the Moment model is best represented as a `JSONB` column type.
4.  **Socket.io to Phoenix Channels**: Replace the socket event listeners in `chatStore.js` with Phoenix Channel topic subscriptions (e.g., subscribing to `"chat:123"` and `"user:456"` topics).
