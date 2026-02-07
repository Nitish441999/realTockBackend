import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { errorHandler } from "./Middlewares/error.middleware.js";
import userRouter from "./Routers/user.route.js";
import messageRouter from "./Routers/message.route.js";
import conversationRouter from "./Routers/conversation.route.js";
import { chatSocket } from "./Socket/index.js";
import refreshTokenRouter from "./Routers/refreshToken.route.js"


dotenv.config();

const app = express();

const server = http.createServer(app);

const corsOptions = {
  origin: "http://localhost:8080",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

const io = new Server(server, {
  cors: corsOptions,
});

chatSocket(io);

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static("public"));

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.get("/", (req, res) => {
  res.send("🚀 Chat Server is running");
});

app.use("/api/user", userRouter);
app.use("/api/message", messageRouter);
app.use("/api/conversation", conversationRouter);
app.use('/api/refresh', refreshTokenRouter)

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

export { app, io, server };
