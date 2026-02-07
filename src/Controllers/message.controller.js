import mongoose from "mongoose";
import { Message } from "../Models/message.model.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { ApiError } from "../Utils/ApiError.js";
import { Conversation } from "../Models/conversation.model.js";
import { getIO } from "../Socket/socket.js";

const sendMessage = asyncHandler(async (req, res) => {
  const sender = req.user._id;
  const { conversationId, content, type = "text" } = req.body;

  if (!conversationId) {
    throw new ApiError(400, "Conversation ID is required");
  }

  if (type === "text" && (!content || !content.trim())) {
    throw new ApiError(400, "Text message cannot be empty");
  }

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  const isParticipant = conversation.participants.some(
    (id) => id.toString() === sender.toString(),
  );

  if (!isParticipant) {
    throw new ApiError(403, "You are not part of this conversation");
  }

  const message = await Message.create({
    conversationId,
    sender,
    content,
    type,
    status: "sent",
    seenBy: [sender],
  });

  conversation.lastMessage = message._id;
  await conversation.save();
  const io = getIO();
  io.to(conversationId).emit("receive-message", {
    conversationId,
    message,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, message, "Message sent successfully"));
});

const getMessages = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { conversationId } = req.params;
  const { cursor, limit = 20 } = req.query;

  if (!conversationId) {
    throw new ApiError(400, "Conversation ID is required");
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });

  if (!conversation) {
    throw new ApiError(403, "You are not part of this conversation");
  }

  const query = {
    conversationId,
  };

  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  const messages = await Message.find(query)
    .populate("sender", "fullName avatar")
    .sort({ createdAt: -1 })
    .limit(Number(limit) + 1);

  const hasMore = messages.length > limit;

  if (hasMore) {
    messages.pop();
  }

  messages.reverse();

  res.status(200).json(
    new ApiResponse(
      200,
      {
        messages,
        hasMore,
        nextCursor: messages.length ? messages[0].createdAt : null,
      },
      "Messages fetched successfully",
    ),
  );
});

const updateMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, type = "text" } = req.body;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid message ID");
  }

  if (type === "text" && (!content || !content.trim())) {
    throw new ApiError(400, "Text message cannot be empty");
  }

  const existingMessage = await Message.findById(id);
  if (!existingMessage) {
    throw new ApiError(404, "Message not found");
  }

  if (existingMessage.sender.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not allowed to edit this message");
  }

  if (existingMessage.seenBy.length === conversation.participants.length) {
    throw new ApiError(400, "Seen message cannot be edited");
  }

  existingMessage.content = content;
  existingMessage.isEdited = true;
  await existingMessage.save();

  const conversation = await Conversation.findById(
    existingMessage.conversationId,
  );
  conversation?.participants.forEach((user) => {
    if (user.toString() !== userId.toString()) {
      req.io.to(user.toString()).emit("messageUpdated", {
        messageId: existingMessage._id,
        content,
        isEdited: true,
      });
    }
  });

  res
    .status(200)
    .json(
      new ApiResponse(200, existingMessage, "Message updated successfully"),
    );
});

const deleteMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid message ID");
  }

  const existingMessage = await Message.findById(id);
  if (!existingMessage) {
    throw new ApiError(404, "Message not found");
  }

  if (existingMessage.sender.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not allowed to delete this message");
  }

  await Message.findByIdAndDelete(id);

  const conversation = await Conversation.findById(
    existingMessage.conversationId,
  );
  conversation?.participants.forEach((participant) => {
    if (participant.toString() !== userId.toString()) {
      req.io.to(participant.toString()).emit("messageDeleted", {
        messageId: id,
      });
    }
  });

  res
    .status(200)
    .json(new ApiResponse(200, {}, "Message deleted successfully"));
});

export { sendMessage, getMessages, updateMessage, deleteMessage };
