import { Message } from "../Models/message.model.js";

export const registerMessageSocket = (io, socket) => {
  socket.on("join-conversation", (conversationId) => {
    socket.join(conversationId);
  });

  socket.on("message-seen", async ({ conversationId, userId }) => {
    await Message.updateMany(
      {
        conversationId,
        sender: { $ne: userId },
        seenBy: { $ne: userId },
      },
      {
        $addToSet: { seenBy: userId },
        $set: { status: "seen" },
      }
    );

    io.to(conversationId).emit("message-seen-update", {
      conversationId,
      userId,
    });
  });
};
