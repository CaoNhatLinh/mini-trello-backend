const { database, db } = require('../config/firebase');

class Board {
  // Create new board
  static async create(boardData) {
    try {
      const boardRef = database.ref('boards').push();
      const newBoard = {
        name: boardData.name,
        description: boardData.description || '',
        ownerId: boardData.ownerId,
        members: boardData.members || [boardData.ownerId],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await boardRef.set(newBoard);
      return { id: boardRef.key, ...newBoard };
    } catch (error) {
      throw new Error(`Error creating board: ${error.message}`);
    }
  }

  // Find board by ID
  static async findById(boardId) {
    try {
      const boardRef = database.ref(`boards/${boardId}`);
      const snapshot = await boardRef.once('value');

      if (!snapshot.exists()) return null;

      return { id: boardId, ...snapshot.val() };
    } catch (error) {
      throw new Error(`Error finding board: ${error.message}`);
    }
  }

  // Find all boards for a user
  static async findByUser(userId) {
    try {
      const boardsRef = database.ref('boards');
      const snapshot = await boardsRef.once('value');

      const boards = [];
      if (snapshot.exists()) {
        snapshot.forEach(childSnapshot => {
          const board = childSnapshot.val();
          if (board.members && board.members.includes(userId)) {
            boards.push({ id: childSnapshot.key, ...board });
          }
        });
      }

      return boards;
    } catch (error) {
      throw new Error(`Error finding user boards: ${error.message}`);
    }
  }

  // Update board
  static async update(boardId, updateData) {
    try {
      const boardRef = database.ref(`boards/${boardId}`);
      const updatedData = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      await boardRef.update(updatedData);
      return true;
    } catch (error) {
      throw new Error(`Error updating board: ${error.message}`);
    }
  }

  // Delete board
  static async delete(boardId) {
    try {
      // Delete all cards in this board first
      const cardsRef = database.ref('cards');
      const cardsSnapshot = await cardsRef.orderByChild('boardId').equalTo(boardId).once('value');
      
      if (cardsSnapshot.exists()) {
        const updates = {};
        cardsSnapshot.forEach(childSnapshot => {
          updates[`cards/${childSnapshot.key}`] = null;
        });
        await database.ref().update(updates);
      }

      // Delete the board
      const boardRef = database.ref(`boards/${boardId}`);
      await boardRef.remove();

      return true;
    } catch (error) {
      throw new Error(`Error deleting board: ${error.message}`);
    }
  }

  // Add member to board
  static async addMember(boardId, memberId) {
    try {
      const board = await this.findById(boardId);
      if (!board) throw new Error('Board not found');
      
      const members = board.members || [];
      if (!members.includes(memberId)) {
        members.push(memberId);
        
        const boardRef = database.ref(`boards/${boardId}`);
        await boardRef.update({
          members,
          updatedAt: new Date().toISOString()
        });
      }
      return true;
    } catch (error) {
      throw new Error(`Error adding member to board: ${error.message}`);
    }
  }

  // Remove member from board
  static async removeMember(boardId, memberId) {
    try {
      const board = await this.findById(boardId);
      if (!board) throw new Error('Board not found');
      
      const members = board.members || [];
      const updatedMembers = members.filter(id => id !== memberId);
      
      const boardRef = database.ref(`boards/${boardId}`);
      await boardRef.update({
        members: updatedMembers,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
      throw new Error(`Error removing member from board: ${error.message}`);
    }
  }

  static async isMember(boardId, userId) {
    try {
      const board = await this.findById(boardId);
      if (!board) return false;
      
      return board.members.includes(userId);
    } catch (error) {
      throw new Error(`Error checking board membership: ${error.message}`);
    }
  }
  static async isOwner(boardId, userId) {
    try {
      const board = await this.findById(boardId);
      if (!board) return false;
      
      return board.ownerId === userId;
    } catch (error) {
      throw new Error(`Error checking board ownership: ${error.message}`);
    }
  }
}

module.exports = Board;