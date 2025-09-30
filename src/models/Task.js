const { db, database } = require('../config/firebase');

class Task {
  // Create new task (item in a card/list)
  static async create(taskData) {
    try {
      const taskRef = database.ref('tasks').push();
      const newTask = {
        title: taskData.title, // Task title
        description: taskData.description || '',
        status: taskData.status || 'todo', // todo, in-progress, done
        cardId: taskData.cardId, // Which list/column this task belongs to
        boardId: taskData.boardId, // Which board this task belongs to
        ownerId: taskData.ownerId,
        assignedMembers: taskData.assignedMembers || [],
        priority: taskData.priority || 'medium', // low, medium, high
        dueDate: taskData.dueDate || null,
        position: taskData.position || 0, // Order within the list
        githubAttachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await taskRef.set(newTask);
      
      // Update card's tasks count
      const Card = require('./Card');
      await Card.updateTasksCount(taskData.cardId);
      
      return { id: taskRef.key, ...newTask };
    } catch (error) {
      throw new Error(`Error creating task: ${error.message}`);
    }
  }

  // Find task by ID
  static async findById(taskId) {
    try {
      const taskRef = database.ref(`tasks/${taskId}`);
      const snapshot = await taskRef.once('value');

      if (!snapshot.exists()) return null;

      return { id: taskId, ...snapshot.val() };
    } catch (error) {
      throw new Error(`Error finding task: ${error.message}`);
    }
  }

  // Find all tasks in a card
  static async findByCard(cardId) {
    try {
      const tasksRef = database.ref('tasks');
      const snapshot = await tasksRef.orderByChild('cardId').equalTo(cardId).once('value');

      const tasks = [];
      snapshot.forEach(childSnapshot => {
        tasks.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });

      return tasks;
    } catch (error) {
      throw new Error(`Error finding card tasks: ${error.message}`);
    }
  }

  // Update task
  static async update(taskId, updateData) {
    try {
      const taskRef = database.ref(`tasks/${taskId}`);
      const updatedData = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      await taskRef.update(updatedData);
      return true;
    } catch (error) {
      throw new Error(`Error updating task: ${error.message}`);
    }
  }

  // Delete task
  static async delete(taskId) {
    try {
      const task = await this.findById(taskId);
      if (!task) return false;

      const taskRef = database.ref(`tasks/${taskId}`);
      await taskRef.remove();

      // Update card's tasks count
      const Card = require('./Card');
      await Card.updateTasksCount(task.cardId);

      return true;
    } catch (error) {
      throw new Error(`Error deleting task: ${error.message}`);
    }
  }

  // Assign member to task
  static async assignMember(taskId, memberId) {
    try {
      const taskRef = database.ref(`tasks/${taskId}`);
      const snapshot = await taskRef.once('value');
      const taskData = snapshot.val();
      
      if (!taskData) throw new Error('Task not found');
      
      const assignedMembers = taskData.assignedMembers || [];
      if (!assignedMembers.includes(memberId)) {
        assignedMembers.push(memberId);
        await taskRef.update({
          assignedMembers,
          updatedAt: new Date().toISOString()
        });
      }
      return true;
    } catch (error) {
      throw new Error(`Error assigning member to task: ${error.message}`);
    }
  }

  // Remove member assignment from task
  static async removeMemberAssignment(taskId, memberId) {
    try {
      const taskRef = database.ref(`tasks/${taskId}`);
      const snapshot = await taskRef.once('value');
      const taskData = snapshot.val();
      
      if (!taskData) throw new Error('Task not found');
      
      const assignedMembers = taskData.assignedMembers || [];
      const filteredMembers = assignedMembers.filter(id => id !== memberId);
      
      await taskRef.update({
        assignedMembers: filteredMembers,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
      throw new Error(`Error removing member assignment: ${error.message}`);
    }
  }

  // Get assigned members of a task
  static async getAssignedMembers(taskId) {
    try {
      const task = await this.findById(taskId);
      if (!task) return [];

      return task.assignedMembers.map(memberId => ({ taskId, memberId }));
    } catch (error) {
      throw new Error(`Error getting assigned members: ${error.message}`);
    }
  }

  // Attach GitHub item to task
  static async attachGitHubItem(taskId, attachmentData, userId, userInfo = null) {
    try {
      const taskRef = database.ref(`tasks/${taskId}`);
      const snapshot = await taskRef.once('value');
      const taskData = snapshot.val();
      
      if (!taskData) throw new Error('Task not found');
      
      const attachmentId = database.ref().push().key; // Generate unique ID

      // Check for duplicates
      const existingAttachments = taskData.githubAttachments || [];
      const isDuplicate = existingAttachments.some(att => 
        att.type === attachmentData.type && 
        att.repository.fullName === attachmentData.repository.fullName &&
        att.githubId === attachmentData.githubId
      );

      if (isDuplicate) {
        throw new Error('This GitHub item is already attached to this task');
      }

      // Create a user-friendly display name using utility
      const { getUserDisplayName } = require('../utils/userUtils');
      const displayName = getUserDisplayName(userInfo, userId);

      // Store only minimal data - metadata will be fetched dynamically from GitHub API
      const attachment = {
        id: attachmentId,
        type: attachmentData.type, // 'branch', 'commit', 'issue', 'pull_request'
        repository: {
          owner: attachmentData.repository.owner,
          name: attachmentData.repository.name,
          fullName: attachmentData.repository.fullName
        },
        githubId: attachmentData.githubId, // branch name, commit sha, issue/PR number
        attachedBy: displayName,
        attachedByUserId: userId,
        attachedAt: new Date().toISOString()
      };

      const githubAttachments = [...existingAttachments, attachment];

      await taskRef.update({
        githubAttachments,
        updatedAt: new Date().toISOString()
      });

      return attachment;
    } catch (error) {
      throw new Error(`Error attaching GitHub item: ${error.message}`);
    }
  }

  // Remove GitHub attachment from task
  static async removeGitHubAttachment(taskId, attachmentId) {
    try {
      const task = await this.findById(taskId);
      if (!task) return false;

      const attachmentToRemove = task.githubAttachments?.find(
        att => att.id === attachmentId
      );

      if (!attachmentToRemove) return false;

      const githubAttachments = task.githubAttachments.filter(
        att => att.id !== attachmentId
      );

      const taskRef = database.ref(`tasks/${taskId}`);
      await taskRef.update({
        githubAttachments,
        updatedAt: new Date().toISOString()
      });

      return attachmentToRemove;
    } catch (error) {
      throw new Error(`Error removing GitHub attachment: ${error.message}`);
    }
  }

  // Get GitHub attachments of a task
  static async getGitHubAttachments(taskId) {
    try {
      const task = await this.findById(taskId);
      if (!task) return [];

      return task.githubAttachments || [];
    } catch (error) {
      throw new Error(`Error getting GitHub attachments: ${error.message}`);
    }
  }

  // Get GitHub attachments with metadata fetched from GitHub API
  static async getGitHubAttachmentsWithMetadata(taskId, githubToken) {
    try {
      console.log('=== GitHub Attachments Metadata Fetch Started ===');
      console.log('TaskId:', taskId, 'GitHubToken provided:', githubToken ? 'YES' : 'NO');
      
      const task = await this.findById(taskId);
      if (!task) return [];

      const attachments = task.githubAttachments || [];
      console.log('Found attachments count:', attachments.length);
      if (!attachments.length) return attachments;
      let workingToken = githubToken;
      
      if (!workingToken) {
        const User = require('./User');
        for (const attachment of attachments) {
          if (attachment.attachedByUserId) {
            try {
              const attachmentOwner = await User.findById(attachment.attachedByUserId);
              console.log('Found attachment owner:', {
                userId: attachment.attachedByUserId,
                hasGithubToken: attachmentOwner && attachmentOwner.githubAccessToken ? 'Yes' : 'No',
                email: attachmentOwner?.email
              });
              
              if (attachmentOwner && attachmentOwner.githubAccessToken) {
                workingToken = attachmentOwner.githubAccessToken;
                console.log('Using GitHub token from attachment owner for metadata fetch');
                break;
              }
            } catch (err) {
              console.warn('Could not fetch user for GitHub token:', err.message);
            }
          }
        }
      }
      
      if (!workingToken) {
        console.warn('No GitHub token available for metadata fetch');
        return attachments;
      }

      const { githubService } = require('../services/githubService');
      
      const attachmentsWithMetadata = await Promise.all(
        attachments.map(async (attachment) => {
          try {
            const metadata = await githubService.getAttachmentMetadata(
              workingToken,
              attachment.repository.owner,
              attachment.repository.name,
              attachment.type,
              attachment.githubId
            );
            return {
              ...attachment,
              ...metadata, 
              repository: attachment.repository 
            };
          } catch (metadataError) {
            console.warn(`Failed to fetch metadata for attachment ${attachment.id}:`, metadataError.message);
            return {
              ...attachment,
              title: attachment.type === 'branch' ? attachment.githubId : 'Unable to fetch details',
              url: attachment.url || `https://github.com/${attachment.repository.fullName}`,
              avatarUrl: null,
              author: {
                name: 'Unknown',
                login: 'Unknown',
                avatar_url: null
              }
            };
          }
        })
      );

      return attachmentsWithMetadata;
    } catch (error) {
      throw new Error(`Error getting GitHub attachments with metadata: ${error.message}`);
    }
  }

  // Move task to different card with position
  static async moveToCard(taskId, newCardId, newBoardId, newPosition) {
    try {
      const task = await this.findById(taskId);
      if (!task) return false;

      const oldCardId = task.cardId;
      await this.update(taskId, {
        cardId: newCardId,
        boardId: newBoardId,
        position: newPosition !== undefined ? newPosition : 0
      });

      const Card = require('./Card');
      await Card.updateTasksCount(oldCardId);
      await Card.updateTasksCount(newCardId);

      return true;
    } catch (error) {
      throw new Error(`Error moving task: ${error.message}`);
    }
  }

  // Reorder tasks within a card
  static async reorderTasksInCard(cardId, taskPositions) {
    try {
      const updates = {};
      
      for (const { taskId, position } of taskPositions) {
        updates[`tasks/${taskId}/position`] = position;
        updates[`tasks/${taskId}/updatedAt`] = new Date().toISOString();
      }
      
      await database.ref().update(updates);
      return true;
    } catch (error) {
      throw new Error(`Error reordering tasks: ${error.message}`);
    }
  }

  // Get next position for new task in card
  static async getNextPosition(cardId) {
    try {
      const tasksRef = database.ref('tasks');
      const snapshot = await tasksRef.orderByChild('cardId').equalTo(cardId).once('value');
      
      let maxPosition = -1;
      snapshot.forEach(childSnapshot => {
        const task = childSnapshot.val();
        if (task.position > maxPosition) {
          maxPosition = task.position;
        }
      });
      
      return maxPosition + 1;
    } catch (error) {
      throw new Error(`Error getting next position: ${error.message}`);
    }
  }

  // Count tasks in a card
  static async countByCard(cardId) {
    try {
      const snapshot = await database.ref('tasks')
        .orderByChild('cardId')
        .equalTo(cardId)
        .once('value');
      
      const tasks = snapshot.val() || {};
      return Object.keys(tasks).length;
    } catch (error) {
      console.error('Count tasks by card error:', error);
      throw error;
    }
  }
}

module.exports = Task;