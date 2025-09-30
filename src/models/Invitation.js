const { db, database } = require('../config/firebase');

class Invitation {
  // Create new invitation
  static async create(invitationData) {
    try {
      const invitationRef = database.ref('invitations').push();
      const newInvitation = {
        boardId: invitationData.boardId,
        boardOwnerId: invitationData.boardOwnerId,
        memberId: invitationData.memberId,
        memberEmail: invitationData.memberEmail,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await invitationRef.set(newInvitation);
      return { id: invitationRef.key, ...newInvitation };
    } catch (error) {
      throw new Error(`Error creating invitation: ${error.message}`);
    }
  }

  // Find invitation by ID
  static async findById(invitationId) {
    try {
      const invitationRef = database.ref(`invitations/${invitationId}`);
      const snapshot = await invitationRef.once('value');

      if (!snapshot.exists()) return null;

      return { id: invitationId, ...snapshot.val() };
    } catch (error) {
      throw new Error(`Error finding invitation: ${error.message}`);
    }
  }

  // Find invitations by member
  static async findByMember(memberId) {
    try {
      const invitationsRef = database.ref('invitations');
      const snapshot = await invitationsRef.orderByChild('memberId').equalTo(memberId).once('value');

      const invitations = [];
      snapshot.forEach(childSnapshot => {
        invitations.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
      invitations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return invitations;
    } catch (error) {
      throw new Error(`Error finding member invitations: ${error.message}`);
    }
  }

  // Find invitations by board
  static async findByBoard(boardId) {
    try {
      const invitationsRef = database.ref('invitations');
      const snapshot = await invitationsRef.orderByChild('boardId').equalTo(boardId).once('value');

      const invitations = [];
      snapshot.forEach(childSnapshot => {
        invitations.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });

      invitations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return invitations;
    } catch (error) {
      throw new Error(`Error finding board invitations: ${error.message}`);
    }
  }

  // Update invitation status
  static async updateStatus(invitationId, status, memberId = null) {
    try {
      const invitation = await this.findById(invitationId);
      if (!invitation) return null;

      if (memberId && invitation.memberId !== memberId) {
        throw new Error('Unauthorized to update this invitation');
      }
      const invitationRef = database.ref(`invitations/${invitationId}`);
      await invitationRef.update({
        status,
        updatedAt: new Date().toISOString()
      });

      if (status === 'accepted') {
        const Board = require('./Board');
        await Board.addMember(invitation.boardId, invitation.memberId);
      }

      return { ...invitation, status };
    } catch (error) {
      throw new Error(`Error updating invitation status: ${error.message}`);
    }
  }

  // Delete invitation
  static async delete(invitationId) {
    try {
      const invitationRef = database.ref(`invitations/${invitationId}`);
      await invitationRef.remove();
      return true;
    } catch (error) {
      throw new Error(`Error deleting invitation: ${error.message}`);
    }
  }

  // Check if invitation exists for board and member
  static async existsForBoardAndMember(boardId, memberId) {
    try {
      const invitationsRef = database.ref('invitations');
      const snapshot = await invitationsRef.once('value');

      let exists = false;
      snapshot.forEach(childSnapshot => {
        const invitation = childSnapshot.val();
        if (invitation.boardId === boardId && 
            invitation.memberId === memberId && 
            invitation.status === 'pending') {
          exists = true;
        }
      });

      return exists;
    } catch (error) {
      throw new Error(`Error checking invitation existence: ${error.message}`);
    }
  }

  // Alias methods for controller compatibility
  static async findByBoardId(boardId) {
    return this.findByBoard(boardId);
  }

  static async findByInviteeId(memberId, status = null) {
    try {
      const invitations = await this.findByMember(memberId);
      
      if (status) {
        return invitations.filter(invitation => invitation.status === status);
      }
      
      return invitations;
    } catch (error) {
      throw new Error(`Error finding invitations by invitee: ${error.message}`);
    }
  }


}

module.exports = Invitation;