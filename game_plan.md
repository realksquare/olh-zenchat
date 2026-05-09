# ZenChat+ Phase 2 Game Plan: UI Revamp & Vanilla Parity

This document outlines the step-by-step strategy for fully porting the Vanilla ZenChat design language and architectural features (from the React/Vite web app) into our React Native / Expo + Phoenix application, ensuring complete parity, native optimization, and offline resilience.

## 1. Design Language & UI Component Translation
The Vanilla ZenChat aesthetic relies heavily on glassmorphism, glowing accents, and smooth typography. We will port the core components explicitly:

- **Blur Effects:** Replace CSS `backdrop-filter: blur(12px)` with `expo-blur` components (`BlurView`) for overlays, `SplashScreen`, and `LoadingOverlay`.
- **Shadows & Glows:** The `SHADOWS` object in `theme/index.js` currently mocks web shadows. We will enhance these using platform-specific elevation and SVG radial gradients.
- **Profile Management:** Build a `ProfileModal` popup allowing users to edit their email, password, avatar image, and username natively.

## 2. Hub (Home) & Sidebar Translation
In the web version, the layout is a two-pane setup (`Sidebar` + `ChatWindow`). On mobile, this becomes a Stack/Tab navigation structure.

- **Header / Profile:** Build a custom header for the `Chats` tab that includes the user's avatar, username, and the **Logout** button.
- **Search Bar:** Implement the sticky search bar with Lucide icons.
- **Chat List (`ChatCard`):** Port the shimmer skeleton loading effect to React Native using animated linear gradients. 
  - **Quick Actions:** Tapping the three dots next to a chat card will reveal options to **Pin chat**, **Add person to Contact**, or **Delete chat**.
- **Online Badges:** Translate the CSS `.online-dot` to absolute positioned green circles on avatars.

## 3. "Aura" (Moments Core) Integration
Vanilla ZenChat's Moments feature includes full-screen immersive media viewing with progress bars and music.

- **The Aura Halo:** A glowing border around avatar circles throughout the app. 
  - **Sapphire:** Unwatched moments posted by the user.
  - **Emerald:** Unwatched moments posted by contacts.
  - **Charcoal:** Viewed moments.
- **`MomentViewer` (Full-Screen Viewer):** 
  - Use `react-native-pager-view` or a flatlist with snap-to-interval to swipe between Auras.
  - Implement a progress bar overlay using React Native `Animated` API to track the duration.
- **Music APIs:** Integrate both **iTunes** and **Deezer** APIs alternately for songs on Moments. Display explicit tags next to song names showing which source provided the track.
- **Backend Schema Mapping:** 
  - The embedded `music` object will be stored as a `JSONB` column in Ecto.
  - Elixir `GenServer` (or Oban job) to automatically sweep and delete Moments older than 24 hours.

## 4. Chat Core & Messaging
- **Message Models:** Replicate robust `MessageBubble` handling for `text`, `image`, `voice`, and `video` payloads.
  - **Status Bubbles:** Message statuses are indicated by bubble background colors instead of traditional ticks: **Grey** (Sent), **Blue** (Delivered), **Green** (Seen).
- **Typing Indicators:** 
  - Standard bouncing **Wave** typing indicator for non-mutual contacts.
  - Advanced **Hacker-text-to-scrambling-decryption** (`DecryptedText`) indicator exclusively for mutual contacts.
- **Actions:** Implement Reply-to, Edit message, "Delete for Everyone/Me", and Star messages logic.
- **Privacy Features:** Port the "View Once" media logic, ensuring media is blurred until tapped and destroyed after viewing.

## 5. Offline-First Resilience, Push & Admin
- **FCM Notifications:** Implement Firebase Cloud Messaging (FCM) using the existing tokens and keys from Vanilla ZenChat's `.env` file to handle push payloads.
- **The Client ID (`cid`):** When generating messages offline, assign a UUID (`cid`). Render this message immediately in the UI (Optimistic UI) and queue it for Phoenix Channel sync.
- **Master Admin Dashboard:** Build out the `Master_Admin` account dashboard capable of monitoring total users, current day active users, and toggling account suspension or deletion.

## Execution Order (For Tomorrow):
1. **The Header, Profiles & Contacts:** Custom Home header, Profile editing modal, and the three-dot contact options on chat cards.
2. **Chat Room Core:** Redesign `MessageBubble`s (color-coded statuses), and implement the dual-mode typing indicator logic.
3. **The Aura System:** Build the glowing Sapphire/Emerald `MomentsRow` rings, the `MomentViewer`, and link up the iTunes/Deezer APIs.
4. **FCM & Admin Board:** Map the push notification handlers and structure the Admin panel stats and actions.

Let's crush this! 🚀
