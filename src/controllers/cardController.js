const Card = require('../models/Card');
const Board = require('../models/Board');
const Task = require('../models/Task');
const { githubService } = require('../services/githubService');
const { emitToBoardRoom } = require('../socket/socketServer');

const cardController = {
  async createCard(req, res) {
    try {
      const { boardId } = req.params;
      const { name, description, position } = req.body; // Changed title to name
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
      const cardData = await Card.create({
        name,
        description,
        boardId,
        position,
        ownerId: userId, 
        createdBy: userId
      });
      emitToBoardRoom(boardId, 'card_created', {
        ...cardData,
        createdBy: userId 
      });
      res.status(201).json({
        success: true,
        message: 'Card created successfully',
        card: cardData
      });
    } catch (error) {
      console.error('Create card error:', error);
      res.status(500).json({
        error: 'Failed to create card',
        message: error.message
      });
    }
  },

  // Get all cards for board
  async getBoardCards(req, res) {
    try {
      const { boardId } = req.params;
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
      const cards = await Card.findByBoard(boardId);
      res.json({
        success: true,
        cards,
        count: cards.length
      });
    } catch (error) {
      console.error('Get board cards error:', error);
      res.status(500).json({
        error: 'Failed to fetch cards',
        message: error.message
      });
    }
  },

  // Get card by ID
  async getCardById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      const card = await Card.findById(id);
      if (!card) {
        return res.status(404).json({
          error: 'Card not found',
          message: 'The requested card does not exist'
        });
      }
      const board = await Board.findById(card.boardId);
      if (!board || !board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not authorized to view this card'
        });
      }

      res.json({
        success: true,
        card
      });
    } catch (error) {
      console.error('Get card error:', error);
      res.status(500).json({
        error: 'Failed to fetch card',
        message: error.message
      });
    }
  },
  // Update card (list/column)
  async updateCard(req, res) {
    try {
      const { boardId, id } = req.params;
      const { name, description, position } = req.body; // Changed title to name
      const userId = req.user.uid;

      const card = await Card.findById(id);
      if (!card) {
        return res.status(404).json({
          error: 'Card not found',
          message: 'The requested card does not exist'
        });
      }

      const board = await Board.findById(card.boardId);
      if (!board || !board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not authorized to update this card'
        });
      }
      await Card.update(id, { name, description, position }); // Changed title to name
      const updatedCard = await Card.findById(id);
      emitToBoardRoom(card.boardId, 'card_updated', updatedCard);
      res.json({
        success: true,
        message: 'Card updated successfully',
        card: updatedCard
      });
    } catch (error) {
      console.error('Update card error:', error);
      res.status(500).json({
        error: 'Failed to update card',
        message: error.message
      });
    }
  },

  async deleteCard(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;
      const card = await Card.findById(id);
      if (!card) {
        return res.status(404).json({
          error: 'Card not found',
          message: 'The requested card does not exist'
        });
      }
      const board = await Board.findById(card.boardId);
      if (!board || !board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not authorized to delete this card'
        });
      }
      emitToBoardRoom(card.boardId, 'card_deleted', { 
        cardId: id, 
        boardId: card.boardId, 
        deletedBy: userId 
      });

      await Card.delete(id);

      res.status(204).json({
        success: true,
        message: 'Card deleted successfully'
      });
    } catch (error) {
      console.error('Delete card error:', error);
      res.status(500).json({
        error: 'Failed to delete card',
        message: error.message
      });
    }
  },
  // Move card to different position
  async moveCard(req, res) {
    try {
      const { id } = req.params;
      const { position } = req.body;
      const userId = req.user.uid;

      const card = await Card.findById(id);
      if (!card) {
        return res.status(404).json({
          error: 'Card not found',
          message: 'The requested card does not exist'
        });
      }

      const board = await Board.findById(card.boardId);
      if (!board || !board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not authorized to move this card'
        });
      }
      await Card.updatePosition(id, position);

      const updatedCard = await Card.findById(id);
      emitToBoardRoom(card.boardId, 'card_moved', updatedCard);
      res.json({
        success: true,
        message: 'Card moved successfully',
        card: updatedCard
      });
    } catch (error) {
      console.error('Move card error:', error);
      res.status(500).json({
        error: 'Failed to move card',
        message: error.message
      });
    }
  },
  // Assign members to card
  async assignMembersToCard(req, res) {
    try {
      const { id } = req.params;
      const { memberIds } = req.body;
      const userId = req.user.uid;

      const card = await Card.findById(id);
      if (!card) {
        return res.status(404).json({
          error: 'Card not found',
          message: 'The requested card does not exist'
        });
      }
      const board = await Board.findById(card.boardId);
      if (!board || !board.members.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You are not authorized to assign members to this card'
        });
      }

      const invalidMembers = memberIds.filter(memberId => !board.members.includes(memberId));
      if (invalidMembers.length > 0) {
        return res.status(400).json({
          error: 'Invalid members',
          message: 'Some members are not part of this board',
          invalidMembers
        });
      }

      await Card.assignMembers(id, memberIds);

      const updatedCard = await Card.findById(id);
      emitToBoardRoom(card.boardId, 'card_members_assigned', {
        cardId: id,
        assignedMembers: memberIds,
        assignedBy: userId,
        card: updatedCard
      });

      res.json({
        success: true,
        message: 'Members assigned successfully',
        card: updatedCard
      });
    } catch (error) {
      console.error('Assign members error:', error);
      res.status(500).json({
        error: 'Failed to assign members',
        message: error.message
      });
    }
  },

  // Get cards by user
  async getCardsByUser(req, res) {
    try {
      const { boardId, userId: targetUserId } = req.params;
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
      const allCards = await Card.findByBoard(boardId);
      const userCards = allCards.filter(card => 
        card.members && card.members.includes(targetUserId)
      );
      const cardsWithDetails = await Promise.all(
        userCards.map(async (card) => {
          const tasksCount = await Task.countByCard(card._id);
          return {
            id: card._id,
            name: card.name,
            description: card.description,
            tasks_count: tasksCount.toString(),
            list_member: card.members || [],
            createdAt: card.createdAt,
            position: card.position,
            boardId: card.boardId
          };
        })
      );

      res.json(cardsWithDetails);
    } catch (error) {
      console.error('Get cards by user error:', error);
      res.status(500).json({
        error: 'Failed to fetch user cards',
        message: error.message
      });
    }
  },

  // Reorder cards within a board
  async reorderCards(req, res) {
    try {
      const { boardId } = req.params;
      const { cardPositions } = req.body; // Array of { cardId, position }
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

      // Reorder cards
      await Card.reorderCardsInBoard(boardId, cardPositions);

      // Emit cards reordered event
      emitToBoardRoom(boardId, 'cards_reordered', {
        boardId,
        cardPositions,
        reorderedBy: userId,
        timestamp: Date.now()
      });

      res.json({
        success: true,
        message: 'Cards reordered successfully'
      });
    } catch (error) {
      console.error('Reorder cards error:', error);
      res.status(500).json({
        error: 'Failed to reorder cards',
        message: error.message
      });
    }
  }
};

module.exports = cardController;