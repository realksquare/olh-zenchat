/**
 * Centralized privacy enforcement logic for presence visibility.
 * 
 * Rules for 'onlineStatus' visibility:
 * - 'everyone': Global visibility, but viewer must also have 'everyone' or 'contacts' (and target is a contact of viewer).
 *               However, for simplicity and as described in rules: 
 *               A sees B if B is everyone AND (A is everyone OR A is contacts and B in A's contacts).
 *               Wait, the exact rule stated by user: "If set to everyone - display online status and last seen for the other user only if they too have everyone or contacts only - if they have added the former as their contact"
 * - 'contacts': Only mutual contacts can see status.
 * - 'nobody': Nobody can see status.
 */

/**
 * Checks if viewerUser is in targetUser's contacts.
 * Assumes contacts is populated or an array of ObjectIds/strings.
 */
const isContact = (user, contactIdStr) => {
  if (!user || !user.contacts) return false;
  return user.contacts.some(c => {
    if (!c) return false;
    const contactUserId = c.userId ? (c.userId._id ? c.userId._id.toString() : c.userId.toString()) : null;
    if (contactUserId) return contactUserId === contactIdStr;
    const directId = c._id ? c._id.toString() : c.toString();
    return directId === contactIdStr;
  });
};

/**
 * Determines if viewerUser can see targetUser's presence (online status / last seen).
 * Both targetUser and viewerUser should be populated user objects or lean documents.
 * Returns boolean.
 */
const canSeePresence = (targetUser, viewerUser) => {
  if (!targetUser || !viewerUser) return false;
  
  const targetIdStr = targetUser._id.toString();
  const viewerIdStr = viewerUser._id.toString();

  // Can always see own presence
  if (targetIdStr === viewerIdStr) return true;

  const targetVisibility = targetUser.privacySettings?.onlineStatus || 'everyone';
  const viewerVisibility = viewerUser.privacySettings?.onlineStatus || 'everyone';

  // If either is 'nobody', visibility is false
  if (targetVisibility === 'nobody' || viewerVisibility === 'nobody') {
    return false;
  }

  const viewerInTargetContacts = isContact(targetUser, viewerIdStr);
  const targetInViewerContacts = isContact(viewerUser, targetIdStr);

  // If target set to contacts, viewer must be a contact AND viewer must allow target
  if (targetVisibility === 'contacts') {
    if (!viewerInTargetContacts) return false;
    
    // Viewer also needs to allow target. If viewer is 'contacts', target must be in viewer's contacts.
    if (viewerVisibility === 'contacts' && !targetInViewerContacts) return false;
    
    return true; // viewer is everyone, or viewer is contacts & target in contacts
  }

  // If target set to everyone
  if (targetVisibility === 'everyone') {
    // User stated: "only if they too have everyone or contacts only - if they have added the former as their contact"
    if (viewerVisibility === 'everyone') {
        return true;
    }
    if (viewerVisibility === 'contacts') {
        return targetInViewerContacts;
    }
  }

  return false;
};

/**
 * Sanitizes an array of users by hiding presence fields if viewer cannot see them.
 * Adds `presenceHidden: true` flag.
 */
const sanitizeUserList = (users, viewerUser) => {
  return users.map(user => {
    const userJson = user.toObject ? user.toObject() : { ...user };
    
    if (!canSeePresence(user, viewerUser)) {
      delete userJson.isOnline;
      delete userJson.lastSeen;
      userJson.presenceHidden = true;
    } else {
      userJson.presenceHidden = false;
    }
    
    return userJson;
  });
};

/**
 * Sanitizes participants within a chat object for a specific viewer.
 */
const sanitizeChatParticipants = (chat, viewerUser) => {
  const chatJson = chat.toObject ? chat.toObject() : { ...chat };
  
  if (chatJson.participants && Array.isArray(chatJson.participants)) {
    chatJson.participants = chatJson.participants.map(p => {
      // Sometimes populate is minimal, but assuming privacySettings are present
      // If not, defaults to everyone.
      if (!p._id) return p; // not populated

      if (!canSeePresence(p, viewerUser)) {
        delete p.isOnline;
        delete p.lastSeen;
        p.presenceHidden = true;
      } else {
        p.presenceHidden = false;
      }
      return p;
    });
  }
  
  return chatJson;
};

module.exports = {
  canSeePresence,
  sanitizeUserList,
  sanitizeChatParticipants,
  isContact
};
