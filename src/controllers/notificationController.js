const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitNewNotification, emitNotificationUpdate, emitNotificationDeleted } = require('../socket/socketServer');

const notificationController = {
  // Get notifications for current user
  async getNotifications(req, res) {
    try {
      const userId = req.user.uid;
      const { limit } = req.query;
      
      const notifications = await Notification.findByUserId(userId, parseInt(limit) || 50);
      
      res.json({
        success: true,
        notifications,
        count: notifications.length
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        error: 'Failed to fetch notifications',
        message: error.message
      });
    }
  },

  // Get unread notifications count
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.uid;
      
      const unreadCount = await Notification.getUnreadCount(userId);
      
      res.json({
        success: true,
        unreadCount
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({
        error: 'Failed to get unread count',
        message: error.message
      });
    }
  },

  // Mark notification as read
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;
      
      // Verify notification belongs to user
      const notification = await Notification.findById(id);
      if (!notification) {
        return res.status(404).json({
          error: 'Notification not found'
        });
      }
      
      if (notification.recipientId !== userId) {
        return res.status(403).json({
          error: 'Access denied'
        });
      }
      
      await Notification.markAsRead(id);
      
      // Emit real-time update
      emitNotificationUpdate(userId, id, { isRead: true });
      
      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        error: 'Failed to mark notification as read',
        message: error.message
      });
    }
  },

  // Mark all notifications as read
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.uid;
      
      await Notification.markAllAsRead(userId);
      
      // Emit real-time update for all notifications
      emitNotificationUpdate(userId, 'all', { isRead: true });
      
      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({
        error: 'Failed to mark all notifications as read',
        message: error.message
      });
    }
  },

  // Delete notification
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;
      
      // Verify notification belongs to user
      const notification = await Notification.findById(id);
      if (!notification) {
        return res.status(404).json({
          error: 'Notification not found'
        });
      }
      
      if (notification.recipientId !== userId) {
        return res.status(403).json({
          error: 'Access denied'
        });
      }

      if (notification.type === 'board_invitation') {
        const invitationId = notification.data?.invitationId || notification.data?.inviteId;
        const invitationStatus = notification.data?.status;
        
        if (invitationId && (!invitationStatus || invitationStatus === 'pending')) {
          try {
            const Invitation = require('../models/Invitation');
            const currentInvitation = await Invitation.findById(invitationId);
            if (currentInvitation && currentInvitation.status === 'pending') {
              await Invitation.updateStatus(invitationId, 'declined', userId);
            } else {
              console.log('Invitation already processed, just deleting notification. Status:', currentInvitation?.status);
            }
          } catch (invitationError) {
            console.warn('Failed to auto-decline invitation:', invitationError.message);
          }
        } else {
          console.log('Invitation not pending, just deleting notification. Status:', invitationStatus);
        }
      }
      
      await Notification.delete(id);
      
      // Emit real-time deletion
      emitNotificationDeleted(userId, id);
      
      res.json({
        success: true,
        message: 'Notification deleted'
      });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        error: 'Failed to delete notification',
        message: error.message
      });
    }
  },

  // Create notification (internal use)
  async createNotification(notificationData) {
    try {
      const notification = await Notification.create(notificationData);
      
      // Emit real-time notification to recipient
      if (notification.recipientId) {
        // Emit real-time notification
    emitNewNotification(notification.userId, notification);
      }
      
      return notification;
    } catch (error) {
      console.error('Create notification error:', error);
      throw error;
    }
  },

  async createBoardInvitationNotification(recipientId, senderId, boardName, invitationId) {
    try {
      const sender = await User.findById(senderId);
      const senderName = sender?.displayName || sender?.email || 'Someone';
      const Invitation = require('../models/Invitation');
      const invitation = await Invitation.findById(invitationId);
      const invitationStatus = invitation?.status || 'pending';
      
      const notification = await this.createNotification({
        type: 'board_invitation',
        title: 'Board Invitation',
        message: `${senderName} invited you to join "${boardName}"`,
        recipientId,
        senderId,
        data: {
          invitationId,
          boardName,
          senderName,
          status: invitationStatus 
        }
      });
      return notification;
    } catch (error) {
      console.error('Create board invitation notification error:', error);
      throw error;
    }
  },

  async createTaskAssignmentNotification(recipientId, senderId, taskTitle, boardId, cardId, taskId) {
    try {
      const sender = await User.findById(senderId);
      const senderName = sender?.displayName || sender?.email || 'Someone';
      
      const notification = await this.createNotification({
        type: 'task_assigned',
        title: 'Task Assigned',
        message: `${senderName} assigned you to "${taskTitle}"`,
        recipientId,
        senderId,
        boardId,
        cardId,
        taskId,
        data: {
          taskTitle,
          senderName
        }
      });
      
      return notification;
    } catch (error) {
      console.error('Create task assignment notification error:', error);
      throw error;
    }
  },

  // Helper method to create board member added notification
  async createBoardMemberAddedNotification(recipientId, senderId, boardName, boardId) {
    try {
      const sender = await User.findById(senderId);
      const senderName = sender?.displayName || sender?.email || 'Someone';
      
      const notification = await this.createNotification({
        type: 'board_member_added',
        title: 'Added to Board',
        message: `You've been added to "${boardName}" by ${senderName}`,
        recipientId,
        senderId,
        boardId,
        data: {
          boardName,
          senderName
        }
      });
      
      return notification;
    } catch (error) {
      console.error('Create board member added notification error:', error);
      throw error;
    }
  },
  async createTaskCommentNotification(recipientId, senderId, taskTitle, boardId, cardId, taskId) {
    try {
      const sender = await User.findById(senderId);
      const senderName = sender?.displayName || sender?.email || 'Someone';
      
      const notification = await this.createNotification({
        type: 'task_comment',
        title: 'New Comment',
        message: `${senderName} commented on "${taskTitle}"`,
        recipientId,
        senderId,
        boardId,
        cardId,
        taskId,
        data: {
          taskTitle,
          senderName
        }
      });
      
      return notification;
    } catch (error) {
      console.error('Create task comment notification error:', error);
      throw error;
    }
  }
};

module.exports = notificationController;
