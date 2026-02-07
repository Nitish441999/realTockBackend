import { registerUserSocket } from "./user.socket.js";
import { registerConversationSocket } from "./conversation.socket.js";
import { registerMessageSocket } from "./message.socket.js";
import { initSocket } from "./socket.js";

const chatSocket = (io) => {
    initSocket(io);
  io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    registerUserSocket(io, socket);
    registerConversationSocket(io, socket);
    registerMessageSocket(io, socket);
  });
};

export { chatSocket };
