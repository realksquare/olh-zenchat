/**
 * Centralized privacy enforcement logic for user profile fields.
 * Symmetrical Privacy Logic: User A can only see User B's field if BOTH A allows B and B allows A.
 */

/**
 * Checks if viewerUser is in targetUser's contacts.
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
 * Determines if viewerUser can see targetUser's specific privacy field (onlineStatus, avatar, fullName).
 * Enforces strict symmetrical visibility.
 */
const canSeeField = (targetUser, viewerUser, fieldName) => {
  if (!targetUser || !viewerUser) return false;
  
  const targetIdStr = targetUser._id ? targetUser._id.toString() : targetUser.toString();
  const viewerIdStr = viewerUser._id ? viewerUser._id.toString() : viewerUser.toString();

  // Can always see own info
  if (targetIdStr === viewerIdStr) return true;

  const targetVisibility = targetUser.privacySettings?.[fieldName] || 'everyone';
  const viewerVisibility = viewerUser.privacySettings?.[fieldName] || 'everyone';

  // If either is 'nobody', visibility is strictly false for both
  if (targetVisibility === 'nobody' || viewerVisibility === 'nobody') {
    return false;
  }

  const viewerInTargetContacts = isContact(targetUser, viewerIdStr);
  const targetInViewerContacts = isContact(viewerUser, targetIdStr);

  const checkAllows = (visibility, isPeerInContacts) => {
      if (visibility === 'everyone') return true;
      if (['contacts', 'family', 'close_circle'].includes(visibility)) return isPeerInContacts;
      return false;
  };

  const targetAllowsViewer = checkAllows(targetVisibility, viewerInTargetContacts);
  const viewerAllowsTarget = checkAllows(viewerVisibility, targetInViewerContacts);

  return targetAllowsViewer && viewerAllowsTarget;
};

// Aliases for clarity
const canSeePresence = (targetUser, viewerUser) => canSeeField(targetUser, viewerUser, 'onlineStatus');
const canSeeAvatar = (targetUser, viewerUser) => canSeeField(targetUser, viewerUser, 'avatar');
const canSeeFullName = (targetUser, viewerUser) => canSeeField(targetUser, viewerUser, 'fullName');

const applySanitization = (userJson, viewerUser) => {
  if (!canSeePresence(userJson, viewerUser)) {
    delete userJson.isOnline;
    delete userJson.lastSeen;
    userJson.presenceHidden = true;
  } else {
    userJson.presenceHidden = false;
  }

  if (!canSeeAvatar(userJson, viewerUser)) {
    delete userJson.avatar;
    userJson.avatarHidden = true;
  }

  if (!canSeeFullName(userJson, viewerUser)) {
    delete userJson.fullName;
    userJson.fullNameHidden = true;
  }

  return userJson;
};

/**
 * Sanitizes an array of users by hiding presence/avatar/fullName if viewer cannot see them.
 */
const sanitizeUserList = (users, viewerUser) => {
  return users.map(user => {
    const userJson = user.toObject ? user.toObject() : { ...user };
    return applySanitization(userJson, viewerUser);
  });
};

/**
 * Sanitizes participants within a chat object for a specific viewer.
 */
const sanitizeChatParticipants = (chat, viewerUser) => {
  const chatJson = chat.toObject ? chat.toObject() : { ...chat };
  
  if (chatJson.participants && Array.isArray(chatJson.participants)) {
    chatJson.participants = chatJson.participants.map(p => {
      if (!p._id) return p;
      return applySanitization(p, viewerUser);
    });
  }
  
  return chatJson;
};

module.exports = {
  canSeePresence,
  canSeeAvatar,
  canSeeFullName,
  sanitizeUserList,
  sanitizeChatParticipants,
  isContact
};
