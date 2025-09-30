const express = require('express');
const router = express.Router();
const boardController = require('../controllers/boardController');
const { authenticateToken } = require('../middleware/auth');
const { 
  validateCreateBoard,
  validateUpdateBoard,
  validateInviteMember,
  validateRespondToInvitation,
    validateAttachGithubItem 
} = require('../middleware/validation');

// Create new board
router.post('/', 
  authenticateToken,
  validateCreateBoard,
  boardController.createBoard
);

// Get all boards for authenticated user
router.get('/', 
  authenticateToken,
  boardController.getUserBoards
);

// Get specific board by ID
router.get('/:id', 
  authenticateToken,
  boardController.getBoardById
);

// Update board
router.put('/:id', 
  authenticateToken,
  validateUpdateBoard,
  boardController.updateBoard
);

// Delete board
router.delete('/:id', 
  authenticateToken,
  boardController.deleteBoard
);

// Invite member to board
router.post('/:boardId/invite', 
  authenticateToken,
  validateInviteMember,
  boardController.inviteMember
);

// Get invitation status
router.get('/invitation/:invitationId/status', 
  authenticateToken,
  boardController.getInvitationStatus
);

// Respond to invitation (accept/decline)
router.post('/invitation/respond', 
  authenticateToken,
  validateRespondToInvitation,
  boardController.respondToInvitation
);

// Get board members
router.get('/:id/members', 
  authenticateToken,
  boardController.getBoardMembers
);

// Remove member from board
router.delete('/:id/members/:memberId', 
  authenticateToken,
  boardController.removeMember
);

// Leave board (current member leaves)
router.post('/:id/leave', 
  authenticateToken,
  boardController.leaveBoard
);

// Import cardController
const cardController = require('../controllers/cardController');
const { validateCreateCard, validateUpdateCard } = require('../middleware/validation');

// 1. Get all cards for a board
router.get('/:boardId/cards', 
  authenticateToken,
  cardController.getBoardCards
);

// 2. Create a new card
router.post('/:boardId/cards', 
  authenticateToken,
  validateCreateCard,
  cardController.createCard
);

// 3. Get specific card details
router.get('/:boardId/cards/:id', 
  authenticateToken,
  cardController.getCardById
);

// 4. Get cards by user
router.get('/:boardId/cards/user/:userId', 
  authenticateToken,
  cardController.getCardsByUser
);

// 5. Update card details
router.put('/:boardId/cards/:id', 
  authenticateToken,
  validateUpdateCard,
  cardController.updateCard
);

router.delete('/:boardId/cards/:id', 
  authenticateToken,
  cardController.deleteCard
);
// === TASK ENDPOINTS ===
const taskController = require('../controllers/taskController');
const { validateCreateTask, validateUpdateTask, validateAssignTask } = require('../middleware/validation');

// 1. Get all tasks for a card
router.get('/:boardId/cards/:cardId/tasks', 
  authenticateToken,
  taskController.getCardTasks
);

// 2. Create new task in card
router.post('/:boardId/cards/:cardId/tasks', 
  authenticateToken,
  validateCreateTask,
  taskController.createTask
);

// 3. Get specific task details
router.get('/:boardId/cards/:cardId/tasks/:taskId', 
  authenticateToken,
  taskController.getTaskById
);

// 4. Update task details
router.put('/:boardId/cards/:cardId/tasks/:taskId', 
  authenticateToken,
  validateUpdateTask,
  taskController.updateTask
);

// 5. Delete task
router.delete('/:boardId/cards/:cardId/tasks/:taskId', 
  authenticateToken,
  taskController.deleteTask
);

// 6. Assign member to task
router.post('/:boardId/cards/:cardId/tasks/:taskId/assign', 
  authenticateToken,
  validateAssignTask,
  taskController.assignMemberToTask
);

// 7. Get assigned members of task
router.get('/:boardId/cards/:cardId/tasks/:taskId/assign', 
  authenticateToken,
  taskController.getTaskMembers
);

// 8. Remove member assignment from task
router.delete('/:boardId/cards/:cardId/tasks/:taskId/assign/:memberId', 
  authenticateToken,
  taskController.removeMemberFromTask
);

// 9. Move task between cards/columns
router.patch('/:boardId/tasks/:taskId/move', 
  authenticateToken,
  taskController.moveTask
);

// // 10. Reorder tasks within a card
// router.patch('/:boardId/cards/:cardId/tasks/reorder', 
//   authenticateToken,
//   taskController.reorderTasks
// );

// // 11. Reorder cards within a board
// router.patch('/:boardId/cards/reorder', 
//   authenticateToken,
//   cardController.reorderCards
// );

// === ADDITIONAL INVITATION ENDPOINTS ===

// Get board invitations
router.get('/:boardId/invitations', 
  authenticateToken,
  boardController.getBoardInvitations
);

// Get user's pending invitations
router.get('/invitations/pending', 
  authenticateToken,
  boardController.getPendingInvitations
);

// Cancel invitation
router.delete('/:boardId/invitations/:invitationId', 
  authenticateToken,
  boardController.cancelInvitation
);



// Attach GitHub item to task (new endpoint structure)
router.post('/:boardId/cards/:cardId/tasks/:taskId/github-attachments', 
  authenticateToken,
  validateAttachGithubItem,
  taskController.attachGithubToTask
);

// Get task GitHub attachments (new endpoint structure)
router.get('/:boardId/cards/:cardId/tasks/:taskId/github-attachments', 
  authenticateToken,
  taskController.getTaskGithubAttachments
);

// Remove GitHub attachment from task
router.delete('/:boardId/cards/:cardId/tasks/:taskId/github-attachments/:attachmentId', 
  authenticateToken,
  taskController.removeGithubAttachment
);

module.exports = router;
