const Board = require("../models/Board");
const Card = require("../models/Card");
const User = require("../models/User");
const Invitation = require("../models/Invitation");
const Notification = require("../models/Notification");
const { sendInvitationEmail } = require("../utils/emailService");
const { emitToBoardRoom, emitToUser } = require("../socket/socketServer");
const notificationController = require("./notificationController");

const boardController = {
  // Create new board
  async createBoard(req, res) {
    try {
      const { name, description } = req.body;
      const ownerId = req.user.uid;

      const boardData = await Board.create({
        name,
        description,
        ownerId,
      });

      // Emit board created event to the user
      emitToUser(ownerId, "board_created", boardData);

      res.status(201).json({
        success: true,
        message: "Board created successfully",
        board: boardData,
      });
    } catch (error) {
      console.error("Create board error:", error);
      res.status(500).json({
        error: "Failed to create board",
        message: error.message,
      });
    }
  },

  // Get all boards for user
  async getUserBoards(req, res) {
    try {
      const userId = req.user.uid;
      const boards = await Board.findByUser(userId);

      res.json({
        success: true,
        boards,
        count: boards.length,
      });
    } catch (error) {
      console.error("Get user boards error:", error);
      res.status(500).json({
        error: "Failed to fetch boards",
        message: error.message,
      });
    }
  },

  // Get board by ID
  async getBoardById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      const board = await Board.findById(id);
      if (!board) {
        return res.status(404).json({
          error: "Board not found",
          message: "The requested board does not exist",
        });
      }

      // Check if user is a member of the board
      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: "Access denied",
          message: "You are not a member of this board",
        });
      }

      res.json({
        success: true,
        board,
      });
    } catch (error) {
      console.error("Get board error:", error);
      res.status(500).json({
        error: "Failed to fetch board",
        message: error.message,
      });
    }
  },

  // Update board
  async updateBoard(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const userId = req.user.uid;

      const board = await Board.findById(id);
      if (!board) {
        return res.status(404).json({
          error: "Board not found",
          message: "The requested board does not exist",
        });
      }

      // Check if user is the owner
      if (board.ownerId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "Only the board owner can update the board",
        });
      }

      await Board.update(id, { name, description });

      const updatedBoard = await Board.findById(id);

      emitToBoardRoom(id, "board_updated", updatedBoard);

      res.json({
        success: true,
        message: "Board updated successfully",
        board: updatedBoard,
      });
    } catch (error) {
      console.error("Update board error:", error);
      res.status(500).json({
        error: "Failed to update board",
        message: error.message,
      });
    }
  },

  // Delete board
  async deleteBoard(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      const board = await Board.findById(id);
      if (!board) {
        return res.status(404).json({
          error: "Board not found",
          message: "The requested board does not exist",
        });
      }

      if (board.ownerId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "Only the board owner can delete the board",
        });
      }

      emitToBoardRoom(id, "board_deleted", { boardId: id, deletedBy: userId });

      await Board.delete(id);

      res.status(204).json({
        success: true,
        message: "Board deleted successfully",
      });
    } catch (error) {
      console.error("Delete board error:", error);
      res.status(500).json({
        error: "Failed to delete board",
        message: error.message,
      });
    }
  },

  // Invite member to board
  async inviteMember(req, res) {
    try {
      const { boardId } = req.params;
      const { member_id, email_member, email } = req.body;
      const userId = req.user.uid;

      // Get email from either email_member or email parameter
      const memberEmail = email_member || email;

      // Validate required fields
      if (!member_id && !memberEmail) {
        return res.status(400).json({
          error: "Member ID or email is required",
          message:
            "Either member_id or email parameter is required to send invitation",
        });
      }

      let memberId = member_id;

      if (!memberId && memberEmail) {
        try {
          const User = require("../models/User");
          const user = await User.findByEmail(memberEmail);
          if (user) {
            memberId = user.id;
          }
        } catch (error) {
          console.warn("Could not find user by email:", error);
        }
      }

      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: "Board not found",
          message: "The requested board does not exist",
        });
      }

      // Check if user is the owner or a member
      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: "Access denied",
          message: "You are not authorized to invite members to this board",
        });
      }

      // Check if member is already in the board (only if we have memberId)
      if (memberId && board.members.includes(memberId)) {
        return res.status(400).json({
          error: "Member already exists",
          message: "This user is already a member of the board",
        });
      }

      // Check if invitation already exists
      let existingInvitation = false;
      if (memberId) {
        existingInvitation = await Invitation.existsForBoardAndMember(
          boardId,
          memberId
        );
      } else if (memberEmail) {
        const invitations = await Invitation.findByBoard(boardId);
        existingInvitation = invitations.some(
          (inv) => inv.memberEmail === memberEmail && inv.status === "pending"
        );
      }

      if (existingInvitation) {
        return res.status(400).json({
          error: "Invitation already sent",
          message: "An invitation has already been sent to this user",
        });
      }

      // Create invitation
      const invitation = await Invitation.create({
        boardId,
        boardOwnerId: board.ownerId,
        memberId: memberId, // Can be null for email-only invitations
        memberEmail: memberEmail,
      });

      if (memberEmail) {
        try {
          const inviter = await User.findById(userId);
          await sendInvitationEmail(
            memberEmail,
            board.name,
            inviter.displayName || inviter.email
          );
        } catch (emailError) {
          console.warn("Failed to send invitation email:", emailError);
        }
      }

      if (memberId) {
        const inviter = await User.findById(userId);

        const existingNotifications = await Notification.findByUserId(memberId);
        const actualInvitationId = invitation.id;

        const duplicateNotification = existingNotifications.find((n) => {
          const isDuplicate =
            n.type === "board_invitation" &&
            n.data?.boardName === board.name &&
            n.senderId === userId &&
            n.data?.invitationId === actualInvitationId;
          return isDuplicate;
        });

        if (!duplicateNotification) {
          try {
            await notificationController.createBoardInvitationNotification(
              memberId,
              userId,
              board.name,
              actualInvitationId
            );
          } catch (notificationError) {
            console.error(
              "Failed to create invitation notification:",
              notificationError
            );
          }
        } else {
          console.log(
            "Duplicate invitation notification detected, skipping creation."
          );
        }
      }

      res.status(200).json({
        success: true,
        message: "Invitation sent successfully",
        invitation: {
          inviteId: invitation.id,
          boardId: invitation.boardId,
          status: invitation.status,
        },
      });
    } catch (error) {
      console.error("Invite member error:", error);
      res.status(500).json({
        error: "Failed to invite member",
        message: error.message,
      });
    }
  },

  // Accept/Decline invitation
  async respondToInvitation(req, res) {
    try {
      const { invite_id, invitationId, status } = req.body;
      const userId = req.user.uid;

      const finalInviteId = invite_id || invitationId;

      if (!["accepted", "declined"].includes(status)) {
        return res.status(400).json({
          error: "Invalid status",
          message: 'Status must be either "accepted" or "declined"',
        });
      }

      const invitation = await Invitation.updateStatus(
        finalInviteId,
        status,
        userId
      );

      if (!invitation) {
        return res.status(404).json({
          error: "Invitation not found",
          message:
            "The invitation does not exist or you are not authorized to respond",
        });
      }

      // If invitation accepted, emit member joined event
      if (status === "accepted") {
        emitToBoardRoom(invitation.boardId, "member_joined", {
          boardId: invitation.boardId,
          newMemberId: userId,
          joinedAt: new Date(),
        });
      }
      try {
        const notifications = await Notification.findByUserId(userId);
        const invitationNotification = notifications.find(
          (n) =>
            (n.type === "board_invitation" ||
              n.type === "board_invitation_accepted") &&
            n.data?.invitationId === finalInviteId
        );
        if (invitationNotification) {
          const updatedData = {
            status: status,
            invitationId: finalInviteId,
          };

          if (invitationNotification.data?.boardName) {
            updatedData.boardName = invitationNotification.data.boardName;
          }
          if (invitationNotification.data?.senderName) {
            updatedData.senderName = invitationNotification.data.senderName;
          }
          if (status === "accepted") {
            await Notification.update(invitationNotification.id, {
              type: "board_invitation_accepted",
              message: `You accepted the invitation to join "${
                invitation.boardName || "board"
              }"`,
              data: updatedData,
              read: true,
            });
          } else if (status === "declined") {
            await Notification.update(invitationNotification.id, {
              type: "board_invitation", // Keep original type
              message: `You declined the invitation to join "${
                invitation.boardName || "board"
              }"`,
              data: updatedData,
              read: true,
            });
          }

          const finalUpdatedNotification = await Notification.findById(
            invitationNotification.id
          );
          emitToUser(userId, "notification_updated", {
            notificationId: invitationNotification.id,
            notification: finalUpdatedNotification,
            action: "updated",
          });
        }
      } catch (notificationError) {
        console.warn(
          "Failed to update notification for invitation response:",
          notificationError.message
        );
      }

      res.json({
        success: true,
        message: `Invitation ${status} successfully`,
        invitation: {
          inviteId: invitation.inviteId,
          status: invitation.status,
        },
      });
    } catch (error) {
      console.error("Respond to invitation error:", error);
      res.status(500).json({
        error: "Failed to respond to invitation",
        message: error.message,
      });
    }
  },

  // Get invitation status
  async getInvitationStatus(req, res) {
    try {
      const { invitationId } = req.params;
      const userId = req.user.uid;

      const invitation = await Invitation.findById(invitationId);
      if (!invitation) {
        return res.status(404).json({
          error: "Invitation not found",
          message: "The invitation does not exist",
        });
      }

      // Check if user is the recipient
      if (invitation.memberId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You are not authorized to view this invitation",
        });
      }

      res.json({
        success: true,
        invitation: {
          inviteId: invitation.inviteId,
          status: invitation.status,
          boardId: invitation.boardId,
          boardName: invitation.boardName,
        },
      });
    } catch (error) {
      console.error("Get invitation status error:", error);
      res.status(500).json({
        error: "Failed to get invitation status",
        message: error.message,
      });
    }
  },

  // Get board members
  async getBoardMembers(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      const board = await Board.findById(id);
      if (!board) {
        return res.status(404).json({
          error: "Board not found",
          message: "The requested board does not exist",
        });
      }

      // Check if user is a member
      if (!board.members.includes(userId)) {
        return res.status(403).json({
          error: "Access denied",
          message: "You are not a member of this board",
        });
      }

      // Get member details
      const members = [];
      for (const memberId of board.members) {
        try {
          const member = await User.findById(memberId);
          if (member) {
            members.push({
              id: member.id,
              email: member.email,
              displayName: member.displayName,
              photoURL: member.photoURL,
              isOwner: member.id === board.ownerId,
            });
          }
        } catch (memberError) {
          console.warn(`Failed to fetch member ${memberId}:`, memberError);
        }
      }

      res.json({
        success: true,
        members,
        count: members.length,
      });
    } catch (error) {
      console.error("Get board members error:", error);
      res.status(500).json({
        error: "Failed to fetch board members",
        message: error.message,
      });
    }
  },

  // Remove member from board
  async removeMember(req, res) {
    try {
      const { id, memberId } = req.params;
      const userId = req.user.uid;

      const board = await Board.findById(id);
      if (!board) {
        return res.status(404).json({
          error: "Board not found",
          message: "The requested board does not exist",
        });
      }

      // Check if user is the owner
      if (board.ownerId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "Only the board owner can remove members",
        });
      }

      // Cannot remove the owner
      if (memberId === board.ownerId) {
        return res.status(400).json({
          error: "Cannot remove owner",
          message: "The board owner cannot be removed from the board",
        });
      }

      await Board.removeMember(id, memberId);

      // Emit member removed event to the board
      emitToBoardRoom(id, "member_removed", {
        boardId: id,
        removedMemberId: memberId,
        removedBy: userId,
      });

      // Notify the removed member
      emitToUser(memberId, "removed_from_board", {
        boardId: id,
        boardName: board.name,
        removedBy: userId,
      });

      res.json({
        success: true,
        message: "Member removed successfully",
      });
    } catch (error) {
      console.error("Remove member error:", error);
      res.status(500).json({
        error: "Failed to remove member",
        message: error.message,
      });
    }
  },

  // Leave board (member leaves voluntarily)
  async leaveBoard(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      const board = await Board.findById(id);
      if (!board) {
        return res.status(404).json({
          error: "Board not found",
          message: "The requested board does not exist",
        });
      }

      // Check if user is a member
      if (!board.members.includes(userId)) {
        return res.status(400).json({
          error: "Not a member",
          message: "You are not a member of this board",
        });
      }

      // Owner cannot leave the board
      if (board.ownerId === userId) {
        return res.status(400).json({
          error: "Cannot leave",
          message:
            "Board owner cannot leave the board. Transfer ownership or delete the board instead.",
        });
      }

      await Board.removeMember(id, userId);

      // Emit member left event to the board
      emitToBoardRoom(id, "member_removed", {
        boardId: id,
        removedMemberId: userId,
        leftVoluntarily: true,
      });

      res.json({
        success: true,
        message: "Successfully left the board",
      });
    } catch (error) {
      console.error("Leave board error:", error);
      res.status(500).json({
        error: "Failed to leave board",
        message: error.message,
      });
    }
  },

  // Get board invitations
  async getBoardInvitations(req, res) {
    try {
      const { boardId } = req.params;
      const userId = req.user.uid;

      // Check if board exists and user is owner or member
      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: "Board not found",
          message: "The requested board does not exist",
        });
      }

      if (board.ownerId !== userId && !board.members.includes(userId)) {
        return res.status(403).json({
          error: "Access denied",
          message: "You are not authorized to view this board's invitations",
        });
      }

      const invitations = await Invitation.findByBoardId(boardId);

      res.json({
        success: true,
        invitations,
        count: invitations.length,
      });
    } catch (error) {
      console.error("Get board invitations error:", error);
      res.status(500).json({
        error: "Failed to get board invitations",
        message: error.message,
      });
    }
  },

  // Get user's pending invitations
  async getPendingInvitations(req, res) {
    try {
      const userId = req.user.uid;

      const invitations = await Invitation.findByInviteeId(userId, "pending");

      res.json({
        success: true,
        invitations,
        count: invitations.length,
      });
    } catch (error) {
      console.error("Get pending invitations error:", error);
      res.status(500).json({
        error: "Failed to get pending invitations",
        message: error.message,
      });
    }
  },

  // Cancel invitation
  async cancelInvitation(req, res) {
    try {
      const { boardId, invitationId } = req.params;
      const userId = req.user.uid;

      // Check if board exists and user is owner
      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({
          error: "Board not found",
          message: "The requested board does not exist",
        });
      }

      if (board.ownerId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "Only the board owner can cancel invitations",
        });
      }

      // Check if invitation exists and belongs to this board
      const invitation = await Invitation.findById(invitationId);
      if (!invitation || invitation.boardId !== boardId) {
        return res.status(404).json({
          error: "Invitation not found",
          message: "The requested invitation does not exist for this board",
        });
      }

      if (invitation.status !== "pending") {
        return res.status(400).json({
          error: "Invalid operation",
          message: "Only pending invitations can be cancelled",
        });
      }

      // Update invitation status to cancelled
      await Invitation.updateStatus(invitationId, "cancelled");

      res.json({
        success: true,
        message: "Invitation cancelled successfully",
      });
    } catch (error) {
      console.error("Cancel invitation error:", error);
      res.status(500).json({
        error: "Failed to cancel invitation",
        message: error.message,
      });
    }
  },
};

module.exports = boardController;
