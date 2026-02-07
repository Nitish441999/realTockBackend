import mongoose from "mongoose";
import { Conversation } from "../Models/conversation.model.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { Message } from "../Models/message.model.js";

const createConversation = asyncHandler(async (req, res) => {
  const { type, participants, name } = req.body;
  const userId = req.user._id;

  if (!type || !participants || participants.length === 0) {
    throw new ApiError(400, "Type and participants are required");
  }

  if (type === "single") {
    const existing = await Conversation.findOne({
      type: "single",
      participants: { $all: [userId, participants[0]] },
    });

    if (existing) {
      return res
        .status(200)
        .json(new ApiResponse(200, existing, "Conversation already exists"));
    }
  }

  const conversation = await Conversation.create({
    type,
    participants:
      type === "single" ? [userId, participants[0]] : [userId, ...participants],
    name: type === "group" ? name : null,
    admin: type === "group" ? userId : null,
  });

  const io = req.app.get("io");

  if (io) {
    conversation.participants.forEach((participantId) => {
      io.to(participantId.toString()).emit(
        "conversation-created",
        conversation
      );
    });
  }

  return res
    .status(201)
    .json(
      new ApiResponse(201, conversation, "Conversation created successfully")
    );
});
const getConversations = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);

  const conversations = await Conversation.aggregate([
    {
      $match: {
        participants: userId,
      },
    },

    {
      $lookup: {
        from: "messages",
        localField: "lastMessage",
        foreignField: "_id",
        as: "lastMessage",
      },
    },
    { $unwind: { path: "$lastMessage", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "users",
        localField: "lastMessage.sender",
        foreignField: "_id",
        as: "lastMessage.sender",
      },
    },
    {
      $unwind: {
        path: "$lastMessage.sender",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $lookup: {
        from: "users",
        localField: "participants",
        foreignField: "_id",
        as: "participants",
      },
    },

    {
      $lookup: {
        from: "users",
        localField: "admin",
        foreignField: "_id",
        as: "admin",
      },
    },
    { $unwind: { path: "$admin", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "messages",
        let: { conversationId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$conversationId", "$$conversationId"] },
                  { $not: [{ $in: [userId, "$seenBy"] }] },
                ],
              },
            },
          },
          { $count: "count" },
        ],
        as: "unread",
      },
    },

    {
      $addFields: {
        unreadCount: { $ifNull: [{ $arrayElemAt: ["$unread.count", 0] }, 0] },
      },
    },

    {
      $project: {
        unread: 0,
        "participants.password": 0,
        "admin.password": 0,
      },
    },

    { $sort: { updatedAt: -1 } },
  ]);

  res
    .status(200)
    .json(new ApiResponse(200, conversations, "Conversations fetched"));
});

const markMessagesAsSeen = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { conversationId } = req.params;
  console.log(conversationId);

  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new ApiError(400, " Conversation ID is invalid");
  }

  const conversationObjectId = new mongoose.Types.ObjectId(conversationId);

  await Message.updateMany(
    {
      conversationId: conversationObjectId,
      sender: { $ne: userId },
      seenBy: { $ne: userId },
    },
    {
      $addToSet: { seenBy: userId },
      $set: { status: "seen" },
    }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Messages marked as seen"));
});

const addMemberToGroup = asyncHandler(async (req, res) => {
  const { conversationId, userId } = req.body;
  const adminId = req.user._id;

  const group = await Conversation.findById(conversationId);
  if (!group || group.type !== "group")
    throw new ApiError(400, "Invalid group");

  if (group.admin.toString() !== adminId.toString())
    throw new ApiError(403, "Only admin can add members");

  if (group.participants.includes(userId))
    throw new ApiError(400, "User already in group");

  group.participants.push(userId);
  await group.save();

  res
    .status(200)
    .json(new ApiResponse(200, group, "Member added successfully"));
});

const updateMemberInGroup = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { participantId } = req.body;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }

  if (!mongoose.Types.ObjectId.isValid(participantId)) {
    throw new ApiError(400, "Invalid participant ID");
  }

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  if (conversation.type !== "group") {
    throw new ApiError(400, "Cannot add member to single chat");
  }

  if (conversation.admin?.toString() !== userId.toString()) {
    throw new ApiError(403, "Only admin can add members");
  }

  const isAlreadyMember = conversation.participants.some(
    (id) => id.toString() === participantId.toString()
  );

  if (isAlreadyMember) {
    throw new ApiError(400, "User already in conversation");
  }

  conversation.participants.push(participantId);
  await conversation.save();

  return res
    .status(200)
    .json(new ApiResponse(200, conversation, "Member added successfully"));
});

const removeMemberInGroup = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { participantId } = req.body;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new ApiError(400, "Conversation ID is invalid");
  }

  if (!mongoose.Types.ObjectId.isValid(participantId)) {
    throw new ApiError(400, "Participant ID is invalid");
  }

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  if (conversation.type !== "group") {
    throw new ApiError(400, "Cannot remove member from single chat");
  }

  if (conversation.admin.toString() !== userId.toString()) {
    throw new ApiError(403, "Only admin can remove members");
  }

  if (participantId.toString() === conversation.admin.toString()) {
    throw new ApiError(400, "Admin cannot remove himself");
  }

  const isMember = conversation.participants.some(
    (id) => id.toString() === participantId.toString()
  );

  if (!isMember) {
    throw new ApiError(400, "User is not in conversation");
  }

  conversation.participants = conversation.participants.filter(
    (id) => id.toString() !== participantId.toString()
  );

  await conversation.save();

  return res
    .status(200)
    .json(new ApiResponse(200, conversation, "Member removed successfully"));
});

const deleteConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new ApiError(400, "Conversation ID is invalid");
  }

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  if (conversation.type === "group") {
    if (conversation.admin.toString() !== userId.toString()) {
      throw new ApiError(403, "Only admin can delete the group");
    }
  }

  if (conversation.type === "single") {
    const isParticipant = conversation.participants.some(
      (id) => id.toString() === userId.toString()
    );

    if (!isParticipant) {
      throw new ApiError(
        403,
        "You are not allowed to delete this conversation"
      );
    }
  }

  await conversation.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Conversation deleted successfully"));
});

export {
  createConversation,
  getConversations,
  addMemberToGroup,
  updateMemberInGroup,
  removeMemberInGroup,
  deleteConversation,
  markMessagesAsSeen,
};
