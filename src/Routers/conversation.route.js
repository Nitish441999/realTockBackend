import { Router } from "express";
import { verifyJWT } from "../Middlewares/auth.middleware.js";
import {
  addMemberToGroup,
  createConversation,
  getConversations,
  markMessagesAsSeen,
} from "../Controllers/conversation.controller.js";
const router = Router();
router.use(verifyJWT);
router.route("/").post(createConversation);
router.route("/").get(getConversations);
router.route("/addmember").post(addMemberToGroup);
router.route("/seen/:conversationId").patch(markMessagesAsSeen);
export default router;
