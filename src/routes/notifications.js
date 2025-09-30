const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get notifications for current user
router.get('/', notificationController.getNotifications);

// Get unread notifications count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Mark all notifications as read
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
