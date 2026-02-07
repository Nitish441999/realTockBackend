import { User } from "../Models/user.model.js";
import onlineUsers from "./onlineUsers.store.js";

export const registerUserSocket = (io, socket) => {
  /* 🔹 JOIN USER */
  socket.on("join-user", async (userId) => {
    if (!userId) return;

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }

    onlineUsers.get(userId).add(socket.id);
    socket.userId = userId;

    socket.join(userId);

    // Update DB only first time
    if (onlineUsers.get(userId).size === 1) {
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: null,
      });

      io.emit("userStatus", {
        userId,
        isOnline: true, // ✅ boolean only
      });

      console.log(`🟢 User ${userId} ONLINE`);
    }
  });

  /* 🔴 DISCONNECT */
  socket.on("disconnect", async () => {
    const userId = socket.userId;
    if (!userId) return;

    const sockets = onlineUsers.get(userId);
    if (!sockets) return;

    sockets.delete(socket.id);

    // User fully offline
    if (sockets.size === 0) {
      onlineUsers.delete(userId);

      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      io.emit("userStatus", {
        userId,
        isOnline: false, // ✅ boolean
      });

      console.log(`🔴 User ${userId} OFFLINE`);
    }
  });
};
