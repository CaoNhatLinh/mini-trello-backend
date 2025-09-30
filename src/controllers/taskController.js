const Task = require('../models/Task');
const Card = require('../models/Card');
const Board = require('../models/Board');
const { githubService } = require('../services/githubService');
const { emitToBoardRoom } = require('../socket/socketServer');

const taskController = {
  // Create new task for /cards/:cardId/tasks (legacy endpoint) 
  async createTaskLegacy(req, res) {
    try {
      const { cardId } = req.params;
      const { title, description, dueDate, priority, assignedTo, labels, githubAttachment } = req.body;
      const userId = req.user.uid;

      // Check if card exists and user has access
      const card = await Card.findById(cardId);
      if (!card) {
        return res.status(404).json({
          error: 'Card not found',
          message: 'The requested card does not exist'
        });
      }

      // Check if user is a member of the board
      const board = await Board.findById(card.boardId);
      if (!board || !board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not authorized to create tasks in this card'
        });
      }

      // Validate assigned members are board members
      if (assignedTo && assignedTo.length > 0) {
        const invalidMembers = assignedTo.filter(memberId => !board.members.includes(memberId));
        if (invalidMembers.length > 0) {
          return res.status(400).json({
            error: 'Invalid assigned members',
            message: 'Some assigned members are not part of this board',
            invalidMembers
          });
        }
      }

      const taskData = await Task.create({
        title,
        description,
        cardId,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'medium',
        assignedTo: assignedTo || [],
        labels: labels || [],
        githubAttachment,
        createdBy: userId
      });

      // Emit task created event to board members
      emitToBoardRoom(board.id, 'task_created', {
        task: taskData,
        cardId,
        boardId: board.id
      });

      res.status(201).json({
        success: true,
        message: 'Task created successfully',
        task: taskData
      });
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({
        error: 'Failed to create task',
        message: error.message
      });
    }
  },

  // Get all tasks for card
  async getCardTasks(req, res) {
    try {
      const { cardId } = req.params;
      const userId = req.user.uid;

      // Check if card exists and user has access
      const card = await Card.findById(cardId);
      if (!card) {
        return res.status(404).json({
          error: 'Card not found',
          message: 'The requested card does not exist'
        });
      }

      // Check if user is a member of the board
      const board = await Board.findById(card.boardId);
      if (!board || !board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not authorized to view tasks in this card'
        });
      }

      const tasks = await Task.findByCard(cardId);

      // Ensure all tasks have githubAttachments field
      const tasksWithAttachments = tasks.map(task => ({
        ...task,
        githubAttachments: task.githubAttachments || []
      }));

      res.json({
        success: true,
        tasks: tasksWithAttachments,
        count: tasks.length
      });
    } catch (error) {
      console.error('Get card tasks error:', error);
      res.status(500).json({
        error: 'Failed to fetch tasks',
        message: error.message
      });
    }
  },

  // Get task by ID (legacy endpoint)
  async getTaskByIdLegacy(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist'
        });
      }

      // Check if user has access through card and board
      const card = await Card.findById(task.cardId);
      const board = await Board.findById(card.boardId);
      
      if (!board || !board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not authorized to view this task'
        });
      }

      res.json({
        success: true,
        task
      });
    } catch (error) {
      console.error('Get task error:', error);
      res.status(500).json({
        error: 'Failed to fetch task',
        message: error.message
      });
    }
  },

  // Update task (legacy endpoint)
  async updateTaskLegacy(req, res) {
    try {
      const { id } = req.params;
      const { title, description, dueDate, priority, assignedTo, labels, status, githubAttachment } = req.body;
      const userId = req.user.uid;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist'
        });
      }

      // Check if user has access through card and board
      const card = await Card.findById(task.cardId);
      const board = await Board.findById(card.boardId);
      
      if (!board || !board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not authorized to update this task'
        });
      }

      // Validate assigned members are board members
      if (assignedTo && assignedTo.length > 0) {
        const invalidMembers = assignedTo.filter(memberId => !board.members.includes(memberId));
        if (invalidMembers.length > 0) {
          return res.status(400).json({
            error: 'Invalid assigned members',
            message: 'Some assigned members are not part of this board',
            invalidMembers
          });
        }
      }

      const updateData = {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : task.dueDate,
        priority,
        assignedTo,
        labels,
        status,
        githubAttachment
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await Task.update(id, updateData);

      const updatedTask = await Task.findById(id);

      // Emit task updated event to board members
      emitToBoardRoom(board.id, 'task_updated', {
        task: updatedTask,
        cardId: task.cardId,
        boardId: board.id
      });

      res.json({
        success: true,
        message: 'Task updated successfully',
        task: updatedTask
      });
    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({
        error: 'Failed to update task',
        message: error.message
      });
    }
  },

  // Delete task (legacy endpoint)
  async deleteTaskLegacy(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist'
        });
      }

      // Check if user has access through card and board
      const card = await Card.findById(task.cardId);
      const board = await Board.findById(card.boardId);
      
      if (!board || !board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not authorized to delete this task'
        });
      }

      // Emit task deleted event to board members before deletion
      emitToBoardRoom(board.id, 'task_deleted', {
        taskId: id,
        cardId: task.cardId,
        boardId: board.id,
        deletedBy: userId
      });

      await Task.delete(id);

      res.status(204).json({
        success: true,
        message: 'Task deleted successfully'
      });
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).json({
        error: 'Failed to delete task',
        message: error.message
      });
    }
  },

  // Toggle task completion
  async toggleTaskCompletion(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist'
        });
      }

      // Check if user has access through card and board
      const card = await Card.findById(task.cardId);
      const board = await Board.findById(card.boardId);
      
      if (!board || !board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not authorized to update this task'
        });
      }

      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const completedAt = newStatus === 'completed' ? new Date() : null;
      const completedBy = newStatus === 'completed' ? userId : null;

      await Task.update(id, { 
        status: newStatus,
        completedAt,
        completedBy
      });

      const updatedTask = await Task.findById(id);

      // Emit task status changed event to board members
      emitToBoardRoom(board.id, 'task_status_changed', {
        task: updatedTask,
        cardId: task.cardId,
        boardId: board.id,
        oldStatus: task.status,
        newStatus,
        changedBy: userId
      });

      res.json({
        success: true,
        message: `Task marked as ${newStatus}`,
        task: updatedTask
      });
    } catch (error) {
      console.error('Toggle task completion error:', error);
      res.status(500).json({
        error: 'Failed to toggle task completion',
        message: error.message
      });
    }
  },

  // Assign task to members
  async assignTask(req, res) {
    try {
      const { id } = req.params;
      const { memberIds } = req.body;
      const userId = req.user.uid;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist'
        });
      }

      // Check if user has access through card and board
      const card = await Card.findById(task.cardId);
      const board = await Board.findById(card.boardId);
      
      if (!board || !board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not authorized to assign this task'
        });
      }

      // Validate that all members are part of the board
      const invalidMembers = memberIds.filter(memberId => !board.members.includes(memberId));
      if (invalidMembers.length > 0) {
        return res.status(400).json({
          error: 'Invalid members',
          message: 'Some members are not part of this board',
          invalidMembers
        });
      }

      await Task.update(id, { assignedTo: memberIds });

      const updatedTask = await Task.findById(id);

      // Emit task assigned event to board members
      emitToBoardRoom(board.id, 'task_assigned', {
        task: updatedTask,
        cardId: task.cardId,
        boardId: board.id,
        assignedMembers: memberIds,
        assignedBy: userId
      });

      res.json({
        success: true,
        message: 'Task assigned successfully',
        task: updatedTask
      });
    } catch (error) {
      console.error('Assign task error:', error);
      res.status(500).json({
        error: 'Failed to assign task',
        message: error.message
      });
    }
  },

  // Attach GitHub item to task
  async attachGithubItem(req, res) {
    try {
      const { id } = req.params;
      const { type, repoOwner, repoName, itemNumber, url, title, description } = req.body;
      const userId = req.user.uid;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist'
        });
      }

      // Check if user has access through card and board
      const card = await Card.findById(task.cardId);
      const board = await Board.findById(card.boardId);
      
      if (!board || !board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not authorized to attach GitHub items to this task'
        });
      }

      // Convert legacy format to new minimal format
      const attachmentData = {
        type, // 'issue', 'pull_request', 'commit', 'branch'
        repository: {
          owner: repoOwner,
          name: repoName,
          fullName: `${repoOwner}/${repoName}`
        },
        githubId: itemNumber || title, // Use itemNumber for issues/PRs, title for others
        // Note: url, title, description will be fetched dynamically from GitHub API
      };

      const attachment = await Task.attachGitHubItem(id, attachmentData, userId);

      res.status(201).json({
        success: true,
        message: 'GitHub item attached successfully',
        attachment
      });
    } catch (error) {
      console.error('Attach GitHub item error:', error);
      res.status(500).json({
        error: 'Failed to attach GitHub item',
        message: error.message
      });
    }
  },

  // Get task GitHub attachments
  async getTaskGithubAttachments(req, res) {
    console.log('Fetched task:', req);
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist'
        });
      }
      console.log('Fetched task:', task);
      // Check if user has access through card and board
      const card = await Card.findById(task.cardId);
      const board = await Board.findById(card.boardId);
      
      if (!board || !board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not authorized to view GitHub attachments on this task'
        });
      }

      // Get user's GitHub token for fetching metadata
      const User = require('../models/User');
      const user = await User.findById(userId);
      const githubToken = user?.githubAccessToken;

      // Get attachments with dynamic metadata from GitHub API
      const githubAttachments = await Task.getGitHubAttachmentsWithMetadata(id, githubToken);

      res.json({
        success: true,
        githubAttachments: githubAttachments.sort((a, b) => new Date(b.attachedAt) - new Date(a.attachedAt)),
        count: githubAttachments.length
      });
    } catch (error) {
      console.error('Get task GitHub attachments error:', error);
      res.status(500).json({
        error: 'Failed to fetch GitHub attachments',
        message: error.message
      });
    }
  },

  // === NEW METHODS FOR BOARDS/:BOARDID/CARDS/:CARDID/TASKS ENDPOINTS ===

  // 1. Get all tasks for a card (boards/:boardId/cards/:cardId/tasks)
  async getCardTasks(req, res) {
    try {
      const { boardId, cardId } = req.params;
      const userId = req.user.uid;

      // Check if board exists and user is a member
      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: 'Board not found',
          message: 'The requested board does not exist'
        });
      }

      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not a member of this board'
        });
      }

      // Check if card exists
      const card = await Card.findById(cardId);
      if (!card || card.boardId !== boardId) {
        return res.status(404).json({
          error: 'Card not found',
          message: 'The requested card does not exist in this board'
        });
      }

      const tasks = await Task.findByCard(cardId);

      // Format response according to requirements
      // Note: GitHub attachments are excluded for performance and should be fetched separately
      const formattedTasks = tasks.map(task => ({
        id: task.id, // Use task.id since Task model returns { id: taskRef.key, ...newTask }
        cardId: task.cardId,
        title: task.title,
        description: task.description,
        status: task.status,
        position: task.position || 0,
        priority: task.priority,
        dueDate: task.dueDate,
        assignedTo: task.assignedTo || [],
        // githubAttachments excluded - use dedicated endpoint /boards/:boardId/cards/:cardId/tasks/:taskId/github-attachments
      }));

      res.json(formattedTasks);
    } catch (error) {
      console.error('Get card tasks error:', error);
      res.status(500).json({
        error: 'Failed to fetch tasks',
        message: error.message
      });
    }
  },

  // 2. Create new task in card (boards/:boardId/cards/:cardId/tasks)
  async createTask(req, res) {
    try {
      const { boardId, cardId } = req.params;
      
      const { title, description, status } = req.body;
      const userId = req.user.uid;

      // Check if board exists and user is a member
      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: 'Board not found',
          message: 'The requested board does not exist'
        });
      }

      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not a member of this board'
        });
      }

      // Check if card exists
      const card = await Card.findById(cardId);
      if (!card || card.boardId !== boardId) {
        return res.status(404).json({
          error: 'Card not found',
          message: 'The requested card does not exist in this board'
        });
      }

      const taskData = await Task.create({
        title,
        description,
        status: status || 'todo',
        cardId,
        boardId,
        ownerId: userId,  // Fixed: use ownerId instead of createdBy
        assignedTo: [],
        priority: 'medium',
        position: 0
      });

      // Emit task created event
      emitToBoardRoom(boardId, 'task_created', taskData);

      res.status(201).json({
        id: taskData.id,  // Fixed: use id instead of _id
        cardId: taskData.cardId,
        ownerId: taskData.ownerId,  // Fixed: use ownerId directly
        title: taskData.title,
        description: taskData.description,
        status: taskData.status
      });
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({
        error: 'Failed to create task',
        message: error.message
      });
    }
  },

  // 3. Get specific task details (boards/:boardId/cards/:cardId/tasks/:taskId)
  async getTaskById(req, res) {
    try {
      const { boardId, cardId, taskId } = req.params;
      const userId = req.user.uid;

      // Check if board exists and user is a member
      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: 'Board not found',
          message: 'The requested board does not exist'
        });
      }

      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not a member of this board'
        });
      }

      // Check if card exists
      const card = await Card.findById(cardId);
      if (!card || card.boardId !== boardId) {
        return res.status(404).json({
          error: 'Card not found',
          message: 'The requested card does not exist in this board'
        });
      }

      const task = await Task.findById(taskId);
      if (!task || task.cardId !== cardId) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist in this card'
        });
      }

      res.json({
        id: task.id,
        cardId: task.cardId,
        title: task.title,
        description: task.description,
        status: task.status,
        position: task.position || 0,
        priority: task.priority,
        dueDate: task.dueDate,
        assignedTo: task.assignedTo || []
        // githubAttachments excluded - use dedicated endpoint /boards/:boardId/cards/:cardId/tasks/:taskId/github-attachments
      });
    } catch (error) {
      console.error('Get task by ID error:', error);
      res.status(500).json({
        error: 'Failed to fetch task',
        message: error.message
      });
    }
  },

  // 4. Update task details (boards/:boardId/cards/:cardId/tasks/:taskId)
  async updateTask(req, res) {
    try {
      const { boardId, cardId, taskId } = req.params;
      console.log('body:', req.body);
      const { title, description, status, targetCardId , priority, dueDate, assignedTo } = req.body;
      const userId = req.user.uid;

      // Check if board exists and user is a member
      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: 'Board not found',
          message: 'The requested board does not exist'
        });
      }

      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not a member of this board'
        });
      }
      // Check if card exists
      const card = await Card.findById(cardId);
      
      if (!card || card.boardId !== boardId) {
        return res.status(404).json({
          error: 'Card not found',
          message: 'The requested card does not exist in this board'
        });
      }

      const task = await Task.findById(taskId);
      if (!task || task.cardId !== cardId) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist in this card'
        });
      }

      // Prepare update data
      const updateData = {
        updatedAt: new Date().toISOString()
      };

      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;
      if (priority !== undefined) updateData.priority = priority;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
      if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
      if (targetCardId && targetCardId !== cardId) {
        // Validate target card exists and belongs to the same board
        const targetCard = await Card.findById(targetCardId);
        if (!targetCard || targetCard.boardId !== boardId) {
          return res.status(404).json({
            error: 'Target card not found',
            message: 'The requested target card does not exist in this board'
          });
        }

        // Move task to target card
        updateData.cardId = targetCardId;
      }

      // Update task
      await Task.update(taskId, updateData);

      const updatedTask = await Task.findById(taskId);

      // Emit task updated event
      emitToBoardRoom(boardId, 'task_updated', {
        task: updatedTask,
        boardId,
        updatedBy: userId,
        timestamp: Date.now()
      });

      res.json({
        id: updatedTask.id,
        cardId: updatedTask.cardId,
        title: updatedTask.title,
        description: updatedTask.description,
        status: updatedTask.status,
        position: updatedTask.position || 0
      });
    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({
        error: 'Failed to update task',
        message: error.message
      });
    }
  },

  // 5. Delete task (boards/:boardId/cards/:cardId/tasks/:taskId)
  async deleteTask(req, res) {
    try {
      const { boardId, cardId, taskId } = req.params;
      const userId = req.user.uid;

      // Check if board exists and user is a member
      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: 'Board not found',
          message: 'The requested board does not exist'
        });
      }

      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not a member of this board'
        });
      }

      // Check if card exists
      const card = await Card.findById(cardId);
      if (!card || card.boardId !== boardId) {
        return res.status(404).json({
          error: 'Card not found',
          message: 'The requested card does not exist in this board'
        });
      }

      const task = await Task.findById(taskId);
      if (!task || task.cardId !== cardId) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist in this card'
        });
      }

      await Task.delete(taskId);

      // Emit task deleted event
      emitToBoardRoom(boardId, 'task_deleted', { taskId, cardId });

      res.status(204).send();
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).json({
        error: 'Failed to delete task',
        message: error.message
      });
    }
  },

  // 6. Assign member to task
  async assignMemberToTask(req, res) {
    try {
      const { boardId, cardId, taskId } = req.params;
      const { memberId } = req.body;
      const userId = req.user.uid;

      // Check if board exists and user is a member
      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: 'Board not found',
          message: 'The requested board does not exist'
        });
      }

      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not a member of this board'
        });
      }

      // Check if member to assign is a board member
      if (!board.members.includes(memberId)) {
        return res.status(400).json({
          error: 'Invalid member',
          message: 'The member to assign is not part of this board'
        });
      }

      const task = await Task.findById(taskId);
      if (!task || task.cardId !== cardId) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist in this card'
        });
      }

      // Add member to task's assignedTo array if not already assigned
      const currentAssignees = task.assignedTo || [];
      if (!currentAssignees.includes(memberId)) {
        await Task.update(taskId, {
          assignedTo: [...currentAssignees, memberId],
          updatedAt: new Date().toISOString()
        });
      }

      // Emit task assignment event
      emitToBoardRoom(boardId, 'task_assigned', { taskId, memberId });

      res.status(201).json({
        taskId,
        memberId
      });
    } catch (error) {
      console.error('Assign member to task error:', error);
      res.status(500).json({
        error: 'Failed to assign member to task',
        message: error.message
      });
    }
  },

  // 7. Get assigned members of task
  async getTaskMembers(req, res) {
    try {
      const { boardId, cardId, taskId } = req.params;
      const userId = req.user.uid;

      // Check if board exists and user is a member
      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: 'Board not found',
          message: 'The requested board does not exist'
        });
      }

      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not a member of this board'
        });
      }

      const task = await Task.findById(taskId);
      if (!task || task.cardId !== cardId) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist in this card'
        });
      }

      const assignedMembers = task.assignedTo || [];
      const membersList = assignedMembers.map(memberId => ({
        taskId,
        memberId
      }));

      res.json(membersList);
    } catch (error) {
      console.error('Get task members error:', error);
      res.status(500).json({
        error: 'Failed to fetch task members',
        message: error.message
      });
    }
  },

  // 8. Remove member assignment from task
  async removeMemberFromTask(req, res) {
    try {
      const { boardId, cardId, taskId, memberId } = req.params;
      const userId = req.user.uid;

      // Check if board exists and user is a member
      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: 'Board not found',
          message: 'The requested board does not exist'
        });
      }

      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not a member of this board'
        });
      }

      const task = await Task.findById(taskId);
      if (!task || task.cardId !== cardId) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist in this card'
        });
      }

      // Remove member from task's assignedTo array
      const currentAssignees = task.assignedTo || [];
      const updatedAssignees = currentAssignees.filter(id => id !== memberId);
      
      await Task.update(taskId, {
        assignedTo: updatedAssignees,
        updatedAt: new Date().toISOString()
      });

      // Emit task unassignment event
      emitToBoardRoom(boardId, 'task_unassigned', { taskId, memberId });

      res.status(204).send();
    } catch (error) {
      console.error('Remove member from task error:', error);
      res.status(500).json({
        error: 'Failed to remove member from task',
        message: error.message
      });
    }
  },

  // Move task between cards/columns with position support
  async moveTask(req, res) {
    try {
      const { boardId, taskId } = req.params;
      const { targetCardId, newPosition } = req.body;
      const userId = req.user.uid;

      // Check if board exists and user is a member
      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: 'Board not found',
          message: 'The requested board does not exist'
        });
      }

      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not a member of this board'
        });
      }

      // Check if task exists
      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist'
        });
      }

      // Check if target card exists and belongs to the board
      const targetCard = await Card.findById(targetCardId);
      if (!targetCard || targetCard.boardId !== boardId) {
        return res.status(404).json({
          error: 'Target card not found',
          message: 'The target card does not exist in this board'
        });
      }

      const sourceCardId = task.cardId;
      
      // Calculate position if not provided
      let taskPosition = newPosition;
      if (taskPosition === undefined) {
        taskPosition = await Task.getNextPosition(targetCardId);
      }

      // If moving to different card, use moveToCard method
      if (sourceCardId !== targetCardId) {
        await Task.moveToCard(taskId, targetCardId, boardId, taskPosition);
      } else {
        // Same card, just update position
        await Task.update(taskId, {
          position: taskPosition,
          updatedAt: new Date().toISOString()
        });
      }

      const updatedTask = await Task.findById(taskId);

      // Emit task updated event to board members for real-time updates
      emitToBoardRoom(boardId, 'task_updated', {
        taskId,
        updates: {
          cardId: targetCardId,
          position: taskPosition
        },
        boardId,
        task: updatedTask,
        updatedBy: userId,
        timestamp: Date.now()
      });

      res.json({
        success: true,
        message: 'Task moved successfully',
        task: {
          id: updatedTask.id,
          cardId: updatedTask.cardId,
          title: updatedTask.title,
          description: updatedTask.description,
          status: updatedTask.status,
          position: updatedTask.position
        }
      });
    } catch (error) {
      console.error('Move task error:', error);
      res.status(500).json({
        error: 'Failed to move task',
        message: error.message
      });
    }
  },

  

  // === GITHUB INTEGRATION ENDPOINTS ===

  // Get repository GitHub info
  async getRepositoryGithubInfo(req, res) {
    try {
      const { repositoryId } = req.params;
      const userId = req.user.uid;

      // Get user's GitHub access token from their profile
      // This assumes you store GitHub tokens in user profiles
      const User = require('../models/User');
      const user = await User.findById(userId);
      
      if (!user || !user.githubAccessToken) {
        return res.status(401).json({
          error: 'GitHub not connected',
          message: 'Please connect your GitHub account first'
        });
      }

      try {
        const GitHubService = require('../services/githubService');
        const githubService = new GitHubService(user.githubAccessToken);
        const githubInfo = await githubService.getRepositoryInfo(repositoryId);
        
        res.json({
          success: true,
          repository: repositoryId,
          githubInfo
        });
      } catch (githubError) {
        return res.status(404).json({
          error: 'Repository not found',
          message: 'Could not fetch GitHub information for this repository'
        });
      }
    } catch (error) {
      console.error('Get repository GitHub info error:', error);
      res.status(500).json({
        error: 'Failed to fetch repository information',
        message: error.message
      });
    }
  },

  // Attach GitHub item to task (new endpoint structure)
  async attachGithubToTask(req, res) {
    try {
      const { boardId, cardId, taskId } = req.params;
      const { type, repository, githubId, url, title, metadata } = req.body;
      const userId = req.user.uid;

      // Check if board exists and user is a member
      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: 'Board not found',
          message: 'The requested board does not exist'
        });
      }

      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not a member of this board'
        });
      }

      // Check if card exists
      const card = await Card.findById(cardId);
      if (!card || card.boardId !== boardId) {
        return res.status(404).json({
          error: 'Card not found',
          message: 'The requested card does not exist in this board'
        });
      }

      const task = await Task.findById(taskId);
      if (!task || task.cardId !== cardId) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist in this card'
        });
      }

      const attachmentData = {
        type, // 'branch', 'commit', 'issue', 'pull_request'
        repository: {
          owner: repository.owner,
          name: repository.name,
          fullName: repository.fullName || `${repository.owner}/${repository.name}`
        },
        githubId // branch name, commit sha, issue/PR number
        // Note: url, title, and metadata will be fetched dynamically from GitHub API
      };

      // Get user information from database for better display name with caching
      const User = require('../models/User');
      const { formatUserForAttachment } = require('../utils/userUtils');
      
      // Simple cache to avoid repeated database calls for the same user
      if (!global.userCache) {
        global.userCache = new Map();
      }
      
      let userDisplayInfo = null;
      
      // Check cache first
      if (global.userCache.has(userId)) {
        const cached = global.userCache.get(userId);
        // Cache for 5 minutes
        if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
          userDisplayInfo = cached.data;
        }
      }
      
      // If not in cache or expired, fetch from database
      if (!userDisplayInfo) {
        try {
          const userInfo = await User.findById(userId);
          userDisplayInfo = formatUserForAttachment(
            userInfo, 
            userId, 
            req.user.email
          );
          
          // Cache the result
          global.userCache.set(userId, {
            data: userDisplayInfo,
            timestamp: Date.now()
          });
        } catch (userError) {
          console.warn('Could not fetch user info for display name:', userError.message);
          // Fallback to req.user info
          userDisplayInfo = formatUserForAttachment(
            { email: req.user.email, displayName: req.user.displayName },
            userId,
            req.user.email
          );
        }
      }

      const attachment = await Task.attachGitHubItem(taskId, attachmentData, userId, userDisplayInfo);

      // Get updated task for realtime update
      const updatedTask = await Task.findById(taskId);

      // Emit GitHub attachment event
      const eventData = {
        taskId,
        cardId,
        boardId,
        attachment,
        timestamp: Date.now(),
        addedBy: {
          userId: userId,
          userEmail: req.user.email || 'Unknown'
        }
      };
      emitToBoardRoom(boardId, 'github_attachment_added', eventData);
      res.status(201).json({
        success: true,
        message: 'GitHub item attached successfully',
        attachment
      });
    } catch (error) {
      console.error('Attach GitHub to task error:', error);
      res.status(500).json({
        error: 'Failed to attach GitHub item',
        message: error.message
      });
    }
  },

  // Get task GitHub attachments (new endpoint structure)
  async getTaskGithubAttachments(req, res) {
    try {
      const { boardId, cardId, taskId } = req.params;
      const userId = req.user.uid;

      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: 'Board not found',
          message: 'The requested board does not exist'
        });
      }

      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not a member of this board'
        });
      }

      const task = await Task.findById(taskId);
      if (!task || task.cardId !== cardId) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist in this card'
        });
      }

      const User = require('../models/User');
      const user = await User.findById(userId);
      const githubToken = user?.githubAccessToken;
      const githubAttachments = await Task.getGitHubAttachmentsWithMetadata(taskId, githubToken);
      res.json({
        success: true,
        githubAttachments: githubAttachments.sort((a, b) => new Date(b.attachedAt) - new Date(a.attachedAt)),
        count: githubAttachments.length
      });
    } catch (error) {
      console.error('Get task GitHub attachments error:', error);
      res.status(500).json({
        error: 'Failed to fetch GitHub attachments',
        message: error.message
      });
    }
  },

  // Remove GitHub attachment from task
  async removeGithubAttachment(req, res) {
    try {
      const { boardId, cardId, taskId, attachmentId } = req.params;
      const userId = req.user.uid;
      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: 'Board not found',
          message: 'The requested board does not exist'
        });
      }

      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not a member of this board'
        });
      }

      const task = await Task.findById(taskId);
      if (!task || task.cardId !== cardId) {
        return res.status(404).json({
          error: 'Task not found',
          message: 'The requested task does not exist in this card'
        });
      }

      // Remove GitHub attachment using Task model method
      const removedAttachment = await Task.removeGitHubAttachment(taskId, attachmentId);
      if (!removedAttachment) {
        return res.status(404).json({
          error: 'Attachment not found',
          message: 'The requested GitHub attachment does not exist'
        });
      }

      const updatedTask = await Task.findById(taskId);

      const eventData = {
        taskId,
        cardId,
        boardId,
        attachmentId,
        timestamp: Date.now(),
        removedBy: {
          userId: userId,
          userEmail: req.user.email || 'Unknown'
        }
      };
      
      emitToBoardRoom(boardId, 'github_attachment_removed', eventData);
      res.status(204).send();
    } catch (error) {
      console.error('Remove GitHub attachment error:', error);
      res.status(500).json({
        error: 'Failed to remove GitHub attachment',
        message: error.message
      });
    }
  }
};

module.exports = taskController;