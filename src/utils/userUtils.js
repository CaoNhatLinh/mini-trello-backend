const getUserDisplayName = (userInfo, userId, fallbackEmail = null) => {
  if (userInfo?.displayName && typeof userInfo.displayName === 'string' && userInfo.displayName.trim()) {
    return userInfo.displayName.trim();
  }
  const email = userInfo?.email || fallbackEmail;
  if (email && typeof email === 'string') {
    const emailName = email.split('@')[0];
    if (emailName.length > 25 || /^user_\d{10,}_\w+$/i.test(emailName)) {
      const parts = emailName.split(/[._-]/);
      const firstPart = parts[0];
      
      if (firstPart && firstPart.toLowerCase() !== 'user' && firstPart.length < 15) {
        return firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
      } else {
        const idPart = emailName.match(/\d+/)?.[0];
        return idPart ? `User ${idPart.slice(-4)}` : 'User';
      }
    } else {
      return emailName.charAt(0).toUpperCase() + emailName.slice(1).toLowerCase();
    }
  }
  if (userId && typeof userId === 'string') {
    const match = userId.match(/^user_(\d+)_(\w+)$/i);
    if (match) {
      const [, timestamp, randomPart] = match;
      return `User ${timestamp.slice(-4)}`;
    }
    if (userId.length > 8) {
      return `User ${userId.slice(-4)}`;
    }
    
    return userId;
  }

  return 'Unknown User';
};

const formatUserForAttachment = (userInfo, userId, fallbackEmail = null) => {
  const displayName = getUserDisplayName(userInfo, userId, fallbackEmail);
  
  return {
    displayName,
    userId,
    email: userInfo?.email || fallbackEmail
  };
};

module.exports = {
  getUserDisplayName,
  formatUserForAttachment
};