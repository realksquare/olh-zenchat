# ZenChat Layout & Media Fixes Task List

- [x] Fix placeholder text alignment in input field after media/file is added
- [ ] Align sidebar & chatcards left-based elements and right-based elements properly for mobile view
- [ ] Correct mobile bottom sheet modal headers alignment (E2EE FAQ & Forward modals)
- [ ] Fix the E2EE/media message bubble collapse & empty rendering bug:
  - [ ] Adjust `minWidth`/`minHeight` styling in `MessageBubble.jsx` `"image"` block to always apply default size when `!isMediaLoaded` regardless of `message.lqip` presence
  - [ ] Add an overlay spinner when status is `"sending"` or `"pending"` for images, videos, GIFs, and stickers
