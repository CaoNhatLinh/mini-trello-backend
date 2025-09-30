const { database } = require('../config/firebase');

class Notification {
  // Create new notification
  static async create(notificationData) {
    try {
      const notificationRef = database.ref('notifications').push();
      const notificationId = notificationRef.key;
      
      const notification = {
        type: notificationData.type, // 'board_invitation', 'task_assigned', 'board_member_added', etc.
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || {}, // Additional data specific to notification type
        recipientId: notificationData.recipientId,
        senderId: notificationData.senderId,
        boardId: notificationData.boardId || null,
        cardId: notificationData.cardId || null,
        taskId: notificationData.taskId || null,
        read: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await notificationRef.set(notification);
      return { id: notificationId, ...notification };
    } catch (error) {
      throw new Error(`Error creating notification: ${error.message}`);
    }
  }

  // Get notifications for a user
  static async findByUserId(userId, limit = 50) {
    try {
      const notificationsRef = database.ref('notifications');
      const snapshot = await notificationsRef
        .orderByChild('recipientId')
        .equalTo(userId)
        .limitToLast(limit)
        .once('value');

      if (!snapshot.exists()) return [];

      const notifications = [];
      snapshot.forEach(childSnapshot => {
        notifications.unshift({ 
          ...childSnapshot.val(),
          id: childSnapshot.key
        });
      });

      return notifications;
    } catch (error) {
      throw new Error(`Error finding notifications: ${error.message}`);
    }
  }

  // Get unread notifications count
  static async getUnreadCount(userId) {
    try {
      const notificationsRef = database.ref('notifications');
      const snapshot = await notificationsRef
        .orderByChild('recipientId')
        .equalTo(userId)
        .once('value');

      if (!snapshot.exists()) return 0;

      let unreadCount = 0;
      snapshot.forEach(childSnapshot => {
        const notification = childSnapshot.val();
        if (!notification.read) {
          unreadCount++;
        }
      });

      return unreadCount;
    } catch (error) {
      throw new Error(`Error getting unread count: ${error.message}`);
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId) {
    try {
      const notificationRef = database.ref(`notifications/${notificationId}`);
      await notificationRef.update({
        read: true,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
      throw new Error(`Error marking notification as read: ${error.message}`);
    }
  }

  // Mark all notifications as read for a user
  static async markAllAsRead(userId) {
    try {
      const notificationsRef = database.ref('notifications');
      const snapshot = await notificationsRef
        .orderByChild('recipientId')
        .equalTo(userId)
        .once('value');

      if (!snapshot.exists()) return true;

      const updates = {};
      snapshot.forEach(childSnapshot => {
        const notification = childSnapshot.val();
        if (!notification.read) {
          updates[`${childSnapshot.key}/read`] = true;
          updates[`${childSnapshot.key}/updatedAt`] = new Date().toISOString();
        }
      });

      if (Object.keys(updates).length > 0) {
        await notificationsRef.update(updates);
      }

      return true;
    } catch (error) {
      throw new Error(`Error marking all notifications as read: ${error.message}`);
    }
  }

  // Update notification
  static async update(notificationId, updateData) {
    try {
      const notificationRef = database.ref(`notifications/${notificationId}`);
      const updates = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      await notificationRef.update(updates);
      
      // Return updated notification
      const snapshot = await notificationRef.once('value');
      const updatedNotification = snapshot.val();
      return updatedNotification;
    } catch (error) {
      console.error('Error updating notification:', error);
      throw new Error(`Error updating notification: ${error.message}`);
    }
  }

  // Delete notification
  static async delete(notificationId) {
    try {
      const notificationRef = database.ref(`notifications/${notificationId}`);
      await notificationRef.remove();
      return true;
    } catch (error) {
      throw new Error(`Error deleting notification: ${error.message}`);
    }
  }

  // Delete old notifications (older than specified days)
  static async deleteOld(days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const notificationsRef = database.ref('notifications');
      const snapshot = await notificationsRef
        .orderByChild('createdAt')
        .endAt(cutoffDate.toISOString())
        .once('value');

      if (!snapshot.exists()) return 0;

      const updates = {};
      let deletedCount = 0;
      snapshot.forEach(childSnapshot => {
        updates[childSnapshot.key] = null; 
        deletedCount++;
      });

      await notificationsRef.update(updates);
      return deletedCount;
    } catch (error) {
      throw new Error(`Error deleting old notifications: ${error.message}`);
    }
  }

  // Find notification by ID
  static async findById(notificationId) {
    try {
      const notificationRef = database.ref(`notifications/${notificationId}`);
      const snapshot = await notificationRef.once('value');
      
      if (!snapshot.exists()) return null;
      
      return {
        id: notificationId,
        ...snapshot.val()
      };
    } catch (error) {
      throw new Error(`Error finding notification: ${error.message}`);
    }
  }
}

module.exports = Notification;
