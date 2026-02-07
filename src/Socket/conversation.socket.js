export const registerConversationSocket = (io, socket) => {
  if (!socket) return;

  // ✅ USER PERSONAL ROOM
  socket.on("join-user", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined personal room`);
  });

  socket.on("join-conversation", (conversationId) => {
    socket.join(conversationId);
  });

  socket.on("send-message", ({ conversationId, message }) => {
    io.to(conversationId).emit("conversation-message", {
      conversationId,
      message,
    });
  });

  socket.on("typing", ({ conversationId, userName, isTyping }) => {
    socket.to(conversationId).emit("typing-update", {
      conversationId,
      userName,
      isTyping,
    });
  });
};
