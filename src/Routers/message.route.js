import { Router } from "express";
import { verifyJWT } from "../Middlewares/auth.middleware.js";
import {
  deleteMessage,
  getMessages,
  sendMessage,
  updateMessage,
} from "../Controllers/message.controller.js";

const router = Router();

router.use(verifyJWT);
router.route("/").post(sendMessage);
router.route("/:conversationId").get(getMessages);
router.route("/:id").put(updateMessage).delete(deleteMessage);

export default router;
