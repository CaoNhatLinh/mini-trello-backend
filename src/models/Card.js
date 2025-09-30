const { db, database } = require('../config/firebase');

class Card {
  // Create new card (list/column)
  static async create(cardData) {
    try {
      const cardRef = database.ref('cards').push();
      
      // Debug log
      console.log('Card.create received data:', cardData);
      
      const newCard = {
        name: cardData.name, 
        description: cardData.description || '',
        boardId: cardData.boardId,
        ownerId: cardData.ownerId || cardData.createdBy, 
        createdBy: cardData.createdBy || cardData.ownerId, 
        members: cardData.members || [cardData.ownerId || cardData.createdBy],
        tasksCount: 0, 
        position: cardData.position || 0, 
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await cardRef.set(newCard);
      return { id: cardRef.key, ...newCard };
    } catch (error) {
      throw new Error(`Error creating card: ${error.message}`);
    }
  }
  // Find card by ID
  static async findById(cardId) {
    try {
      const cardRef = database.ref(`cards/${cardId}`);
      const snapshot = await cardRef.once('value');

      if (!snapshot.exists()) return null;

      return { id: cardId, ...snapshot.val() };
    } catch (error) {
      throw new Error(`Error finding card: ${error.message}`);
    }
  }

  // Find all cards in a board
  static async findByBoard(boardId) {
    try {
      const cardsRef = database.ref('cards');
      const snapshot = await cardsRef.orderByChild('boardId').equalTo(boardId).once('value');

      const cards = [];
      snapshot.forEach(childSnapshot => {
        cards.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });

      return cards;
    } catch (error) {
      throw new Error(`Error finding board cards: ${error.message}`);
    }
  }

  // Find cards by user
  static async findByUser(boardId, userId) {
    try {
      const cardsRef = database.ref('cards');
      const snapshot = await cardsRef.orderByChild('boardId').equalTo(boardId).once('value');

      const cards = [];
      const promises = [];
      
      snapshot.forEach(childSnapshot => {
        const cardData = { id: childSnapshot.key, ...childSnapshot.val() };
        if (cardData.members && cardData.members.includes(userId)) {
          promises.push(
            database.ref('tasks').orderByChild('cardId').equalTo(childSnapshot.key).once('value')
              .then(tasksSnapshot => {
                cardData.tasks_count = tasksSnapshot.numChildren();
                cardData.list_member = cardData.members;
                cards.push(cardData);
              })
          );
        }
      });
      
      await Promise.all(promises);
      return cards;
    } catch (error) {
      throw new Error(`Error finding user cards: ${error.message}`);
    }
  }

  // Update card
  static async update(cardId, updateData) {
    try {
      const cardRef = database.ref(`cards/${cardId}`);
      const updatedData = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      await cardRef.update(updatedData);
      return true;
    } catch (error) {
      throw new Error(`Error updating card: ${error.message}`);
    }
  }

  // Delete card
  static async delete(cardId) {
    try {
      const tasksSnapshot = await database.ref('tasks').orderByChild('cardId').equalTo(cardId).once('value');
      const deletePromises = [];
      
      tasksSnapshot.forEach(taskSnapshot => {
        deletePromises.push(database.ref(`tasks/${taskSnapshot.key}`).remove());
      });
      await Promise.all(deletePromises);
      await database.ref(`cards/${cardId}`).remove();

      return true;
    } catch (error) {
      throw new Error(`Error deleting card: ${error.message}`);
    }
  }

  // Add member to card
  static async addMember(cardId, memberId) {
    try {
      const cardRef = database.ref(`cards/${cardId}`);
      const snapshot = await cardRef.once('value');
      const cardData = snapshot.val();
      
      if (!cardData) throw new Error('Card not found');
      
      const members = cardData.members || [];
      if (!members.includes(memberId)) {
        members.push(memberId);
        await cardRef.update({
          members,
          updatedAt: new Date().toISOString()
        });
      }
      return true;
    } catch (error) {
      throw new Error(`Error adding member to card: ${error.message}`);
    }
  }

  // Remove member from card
  static async removeMember(cardId, memberId) {
    try {
      const cardRef = database.ref(`cards/${cardId}`);
      const snapshot = await cardRef.once('value');
      const cardData = snapshot.val();
      
      if (!cardData) throw new Error('Card not found');
      
      const members = cardData.members || [];
      const filteredMembers = members.filter(id => id !== memberId);
      
      await cardRef.update({
        members: filteredMembers,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
      throw new Error(`Error removing member from card: ${error.message}`);
    }
  }

  // Update tasks count
  static async updateTasksCount(cardId) {
    try {
      const tasksSnapshot = await database.ref('tasks').orderByChild('cardId').equalTo(cardId).once('value');

      const cardRef = database.ref(`cards/${cardId}`);
      await cardRef.update({
        tasksCount: tasksSnapshot.numChildren(),
        updatedAt: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      throw new Error(`Error updating tasks count: ${error.message}`);
    }
  }

  // Check if user is card member
  static async isMember(cardId, userId) {
    try {
      const card = await this.findById(cardId);
      if (!card) return false;
      
      return card.members.includes(userId);
    } catch (error) {
      throw new Error(`Error checking card membership: ${error.message}`);
    }
  }

  // Check if user is card owner
  static async isOwner(cardId, userId) {
    try {
      const card = await this.findById(cardId);
      if (!card) return false;
      
      return card.ownerId === userId;
    } catch (error) {
      throw new Error(`Error checking card ownership: ${error.message}`);
    }
  }

  // Reorder cards within a board
  static async reorderCardsInBoard(boardId, cardPositions) {
    try {
      const updates = {};
      
      for (const { cardId, position } of cardPositions) {
        updates[`cards/${cardId}/position`] = position;
        updates[`cards/${cardId}/updatedAt`] = new Date().toISOString();
      }
      
      await database.ref().update(updates);
      return true;
    } catch (error) {
      throw new Error(`Error reordering cards: ${error.message}`);
    }
  }

  // Get next position for new card in board
  static async getNextPosition(boardId) {
    try {
      const cardsRef = database.ref('cards');
      const snapshot = await cardsRef.orderByChild('boardId').equalTo(boardId).once('value');
      
      let maxPosition = -1;
      snapshot.forEach(childSnapshot => {
        const card = childSnapshot.val();
        if (card.position > maxPosition) {
          maxPosition = card.position;
        }
      });
      
      return maxPosition + 1;
    } catch (error) {
      throw new Error(`Error getting next position: ${error.message}`);
    }
  }
}

module.exports = Card;