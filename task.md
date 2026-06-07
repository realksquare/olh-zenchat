# Task List: Fix Desktop Modals Mid-Left Rendering Shift

- [x] Modify CSS layout rules in `client/src/index.css`
  - [x] Adjust `.moments-aura-content` sizing (`width: 480px; max-width: 100%;`)
  - [x] Adjust `.profile-modal` sizing (`width: 400px; max-width: 100%;`)
  - [x] Adjust `.zen-modal-container` sizing (`width: 400px; max-width: 100%;`)
  - [x] Adjust `.delete-modal` sizing (`width: 320px; max-width: 90%;`)
  - [x] Adjust `.admin-modal-content` sizing (`width: 800px; max-width: 100%;`)
  - [x] Add desktop `@media (min-width: 769px)` override to set `margin: auto` on modal contents for solid centering
- [x] Swap inline style properties (`width` and `maxWidth`) in JSX files
  - [x] Modify [ProfileModal.jsx](file:///c:/olh-zenchat/client/src/components/ui/ProfileModal.jsx)
  - [x] Modify [InviteModal.jsx](file:///c:/olh-zenchat/client/src/components/ui/InviteModal.jsx)
- [x] Run client build to verify compilation (`npm run build` in client)
- [x] Verify fix visually in browser using browser subagent
