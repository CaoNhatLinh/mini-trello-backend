const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        socket.userId = decodedToken.uid;
        socket.userEmail = decodedToken.email;
        next();
      } catch (firebaseError) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          socket.userId = decoded.uid || decoded.id;
          socket.userEmail = decoded.email;
          
          // If no email in token, try to get from database
          if (!socket.userEmail && socket.userId) {
            try {
              const User = require('../models/User');
              const user = await User.findById(socket.userId);
              if (user) {
                socket.userEmail = user.email || user.displayName || user.githubProfile?.login || 'Unknown';
              }
            } catch (dbError) {
              console.warn('Could not fetch user info from database:', dbError.message);
            }
          }
          
          console.log(`User authenticated with JWT: ${socket.userEmail || 'No email'} (${socket.userId})`);
          next();
        } catch (jwtError) {
          console.error('Socket authentication failed for both Firebase and JWT:', {
            firebase: firebaseError.message,
            jwt: jwtError.message
          });
          next(new Error('Authentication error: Invalid token'));
        }
      }
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_board', (boardId) => {
      socket.join(`board_${boardId}`);
      socket.to(`board_${boardId}`).emit('user_joined', {
        userId: socket.userId,
        userEmail: socket.userEmail,
        boardId
      });
    });

    // Leave board room
    socket.on('leave_board', (boardId) => {
      socket.leave(`board_${boardId}`);
      socket.to(`board_${boardId}`).emit('user_left', {
        userId: socket.userId,
        userEmail: socket.userEmail,
        boardId
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userEmail} (${socket.id})`);
    });

    // Task update events
    socket.on('task_updated', (data) => {
      const { taskId, updates, boardId, timestamp } = data;
      socket.to(`board_${boardId}`).emit('task_updated', {
        taskId,
        updates,
        boardId,
        timestamp,
        updatedBy: {
          userId: socket.userId,
          userEmail: socket.userEmail
        }
      });
    });

    socket.join(`user_${socket.userId}`);

    socket.on('mark_notification_read', (notificationId) => {
      socket.to(`user_${socket.userId}`).emit('notification_marked_read', { notificationId });
    });

    socket.on('github_attachment_added', (data) => {
      const { taskId, cardId, boardId, attachment, timestamp } = data;
      socket.to(`board_${boardId}`).emit('github_attachment_added', {
        taskId,
        cardId,
        boardId,
        attachment,
        timestamp,
        addedBy: {
          userId: socket.userId,
          userEmail: socket.userEmail
        }
      });
    });

    socket.on('github_attachment_removed', (data) => {
      const { taskId, cardId, boardId, attachmentId, timestamp } = data;
      
      // Broadcast GitHub attachment removal to all users in the board
      socket.to(`board_${boardId}`).emit('github_attachment_removed', {
        taskId,
        cardId,
        boardId,
        attachmentId,
        timestamp,
        removedBy: {
          userId: socket.userId,
          userEmail: socket.userEmail
        }
      });
    });
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userEmail}:`, error);
    });
  });

  return io;
}

function emitToBoardRoom(boardId, event, data) {
  if (io) {
    io.to(`board_${boardId}`).emit(event, data);
  }
}

function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
}

function emitToAllUsers(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

function getBoardRoomUsers(boardId) {
  if (io) {
    const room = io.sockets.adapter.rooms.get(`board_${boardId}`);
    if (room) {
      const users = [];
      for (const socketId of room) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          users.push({
            userId: socket.userId,
            userEmail: socket.userEmail,
            socketId: socket.id
          });
        }
      }
      return users;
    }
  }
  return [];
}

function emitNewNotification(userId, notification) {
  if (io) {
    io.to(`user_${userId}`).emit('new_notification', notification);
  }
}
function emitNotificationUpdate(userId, notificationId, updates) {
  if (io) {
    io.to(`user_${userId}`).emit('notification_updated', { notificationId, updates });
  }
}
function emitNotificationDeleted(userId, notificationId) {
  if (io) {
    io.to(`user_${userId}`).emit('notification_deleted', { notificationId });
  }
}
module.exports = {
  initSocket,
  emitToBoardRoom,
  emitToUser,
  emitToAllUsers,
  getBoardRoomUsers,
  emitNewNotification,
  emitNotificationUpdate,
  emitNotificationDeleted,
  getIO: () => io
};