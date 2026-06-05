# Implementation Plan: Double Notifications Fix, Moments Replies Tagging, and Resharing for Tagged Users

Detailed implementation plan for addressing notifications priority/duplicates, tagging moments in DM replies, and adding quick-reshare options for tagged users.

## User Review Required

> [!IMPORTANT]
> - **FCM Payload Shift (Data-only Push)**: We will modify the server-side push notification utility to send messages using a `data`-only payload structure. This stops Chrome and WebAPK shells from automatically displaying fallback/duplicate notifications, letting the service worker programmatically show exactly **one** unified notification using the data payload.
> - **Schema Updates**: We are adding `replyToMoment` and `replyToMomentUsername` to the `Message` model, and `resharedFrom` to the `Moment` model. MongoDB handles schema modification seamlessly, and existing documents will gracefully defaults to null/empty without needing migrations.

## Open Questions

None. The requested features align perfectly with the existing MERN stack architecture, socket events, and service worker database setups.

---

## Proposed Changes

### 1. Notifications Priority & Duplicates

#### [MODIFY] [firebase.js](file:///c:/olh-zenchat/server/utils/firebase.js)
- Modify the `sendPushNotification` function to make the FCM payloads **data-only** for web/PWA clients.
- Remove the root-level `notification` field and `webpush.notification` field.
- Copy the `title` and `body` fields into the `data` payload so the service worker can read them:
  ```javascript
  const message = {
      token: fcmToken,
      data: {
          ...stringData,
          title: String(title),
          body: String(body),
      },
      webpush: {
          headers: { Urgency: "high" },
          fcm_options: {
              link: clickUrl
          }
      },
      android: {
          priority: "high",
      },
      apns: {
          headers: { "apns-priority": "10" },
      }
  };
  ```

#### [MODIFY] [firebase-messaging-sw.js](file:///c:/olh-zenchat/client/public/firebase-messaging-sw.js)
- Update the background messaging listener to read the notification `title` and `body` from `payload.data` instead of `payload.notification`:
  ```javascript
  let newTitle = payload.data?.title || payload.notification?.title || 'New Message';
  let newBody = payload.data?.body || payload.notification?.body || '';
  ```

---

### 2. Reply to Moments Tagging

#### [MODIFY] [Message.js](file:///c:/olh-zenchat/server/models/Message.js)
- Add the following fields to `messageSchema` to store references to the reshared/replied moment:
  ```javascript
  replyToMoment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Moment",
      default: null,
  },
  replyToMomentUsername: {
      type: String,
      default: "",
  }
  ```

#### [MODIFY] [packetCompressor.js](file:///c:/olh-zenchat/server/utils/packetCompressor.js) & [packetCompressor.js](file:///c:/olh-zenchat/client/src/utils/packetCompressor.js)
- Map `replyToMoment` (compressed as `rm`) and `replyToMomentUsername` (compressed as `rmu`) in both `compressPacket` and `decompressPacket` utilities:
  ```javascript
  // In compressPacket:
  if (msg.replyToMoment) {
      compressed.rm = typeof msg.replyToMoment === 'object' ? {
          _id: msg.replyToMoment._id || msg.replyToMoment,
          userId: msg.replyToMoment.userId,
          type: msg.replyToMoment.type,
          content: msg.replyToMoment.content,
          mediaUrl: msg.replyToMoment.mediaUrl,
          music: msg.replyToMoment.music,
          caption: msg.replyToMoment.caption,
          locationTag: msg.replyToMoment.locationTag,
          filter: msg.replyToMoment.filter,
      } : msg.replyToMoment;
  }
  if (msg.replyToMomentUsername !== undefined) compressed.rmu = msg.replyToMomentUsername;

  // In decompressPacket:
  replyToMoment: msg.rm,
  replyToMomentUsername: msg.rmu,
  ```

#### [MODIFY] [handlers.js](file:///c:/olh-zenchat/server/socket/handlers.js)
- Extract `replyToMoment` and `replyToMomentUsername` from the decompressed payload inside the socket `send_message` event handler.
- Save these values when calling `Message.create`.
- Add `.populate("replyToMoment")` to the Message find query after creation (line 526) so it is returned fully populated.
- Update other `.populate("replyTo")` calls in socket handlers to also populate `replyToMoment` (e.g., lines 303, 696).

#### [MODIFY] [message.js](file:///c:/olh-zenchat/server/routes/message.js)
- Add `.populate("replyToMoment")` to message fetch queries (lines 57, 213).
- Update the `/offline-sync` endpoint (line 388) to extract `replyToMoment` and `replyToMomentUsername` from the synced payload array, save them during bulk creation, and populate them before broadcasting.

#### [MODIFY] [SocketContext.jsx](file:///c:/olh-zenchat/client/src/context/SocketContext.jsx)
- Modify the `sendMessage` callback arguments and payload construction to pass `replyToMoment` and `replyToMomentUsername`:
  ```javascript
  const sendMessage = useCallback(async (chatId, content, type = "text", mediaUrl = "", replyTo = null, isViewOnce = false, cid = null, isZenMessage = false, waveform = "", replyToMoment = null, replyToMomentUsername = "") => {
      // ...
      let payload = { chatId, content, type, mediaUrl, replyTo, isViewOnce, cid, isLowBandwidth, isZenMessage, waveform, replyToMoment, replyToMomentUsername };
      // ...
  ```

#### [MODIFY] [MomentViewer.jsx](file:///c:/olh-zenchat/client/src/components/chat/MomentViewer.jsx)
- Update `handleSendReply` to fetch the moment owner's username and pass `currentMoment._id` and `currentMoment.userId.username` to `sendMessage`:
  ```javascript
  const targetUsername = currentMoment.userId?.username || "";
  await sendMessage(chatId, replyText, "text", "", null, false, null, false, "", currentMoment._id, targetUsername);
  ```
- Replace the local custom absolute toast with the unified toast system `showZenToast` from `useSocket()` context:
  ```javascript
  const { sendMessage, showZenToast } = useSocket();
  // ...
  showZenToast("success", "Reply sent via DM!");
  ```

#### [MODIFY] [MessageBubble.jsx](file:///c:/olh-zenchat/client/src/components/chat/MessageBubble.jsx)
- Define a `repliedToMoment` memo that resolves `message.replyToMoment` from the store or message payload.
- In the message container layout, if `message.replyToMoment` is set, render the tag: `"Reply to @(username)'s #Moment"` with an emerald indicator border.
- Add a click handler to the tag:
  - If the moment exists, call `useMomentStore.getState().setActiveViewerMoments([repliedToMoment])`.
  - If the moment does not exist (null/undefined), do nothing on click.

---

### 3. Resharing Moments for Tagged Users

#### [MODIFY] [Moment.js](file:///c:/olh-zenchat/server/models/Moment.js)
- Add a `resharedFrom` field referencing the `Moment` model:
  ```javascript
  resharedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Moment",
      default: null,
  }
  ```

#### [MODIFY] [momentRoutes.js](file:///c:/olh-zenchat/server/routes/momentRoutes.js)
- Implement a new `POST /:id/reshare` route for quick-resharing:
  - Find the target moment by ID.
  - Verify that the current user (`req.user._id`) is tagged in `moment.taggedUsers`.
  - Check if the user has already reshared the moment (`resharedFrom: req.params.id`) to prevent duplicate posts.
  - Duplicate the moment properties with `userId: req.user._id` and `resharedFrom: moment._id`.
  - Save the moment and emit the `new_moment` socket event.
  - Query contacts (prioritizing PWA device tokens) and send push notifications: `"${user.username} has shared a #moment.!"`.

#### [MODIFY] [MomentViewer.jsx](file:///c:/olh-zenchat/client/src/components/chat/MomentViewer.jsx)
- Check if the current user is a tagged user in the moment:
  ```javascript
  const isTaggedUser = useMemo(() => {
      if (!currentMoment || !currentMoment.taggedUsers) return false;
      return currentMoment.taggedUsers.some(u => (u._id || u).toString() === currentUserId.toString());
  }, [currentMoment, currentUserId]);
  ```
- If `isTaggedUser` is true, render a **Reshare** button left of the like button inside the reply bar.
- Use a repeat/recycle arrow SVG icon for the button.
- When clicked, trigger the `/reshare` API call:
  - Disable the button during request to avoid double-taps.
  - On success, call `useMomentStore.getState().fetchMoments()` to sync the local timeline.
  - Show a site-consistent toast: `showZenToast("success", "Moment reshared to your feed!");`
- Hide the tagged users' list from the moment header (i.e. remove the `"with @user1, @user2"` display next to the username).

---

## Verification Plan

### Automated Tests
- Run `npm run build` inside the `client` folder to ensure clean JS/JSX compilation.
- Start the server (`npm run dev`) to verify no runtime syntax or model initialization failures.

### Manual Verification
- **Double Notifications Priority**: Sign in on PWA and browser on the same phone. Lock screen / push both apps to background. Send a message to this user and confirm only one notification is shown (prioritizing PWA/Service worker).
- **Reply Tagging**: Reply to another user's moment. Verify that the message in chat bubble displays `"Reply to @username's #Moment"`. Click it to verify it opens the viewer at that specific moment. Verify that if the moment expires/is deleted, the tag still shows the username but clicking it has no effect.
- **Reshare Moments**: Create a moment, tagging another user (contact). Log in as the tagged user, open the moment, verify that the Reshare button is visible to the left of the like button. Click reshare, verify that the moment gets cloned to your own moments, and you receive the "Moment reshared to your feed!" toast. Check that the tagged users' list is hidden from the header.
