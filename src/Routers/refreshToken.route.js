import { Router } from "express";
import { refreshAccessToken } from "../Controllers/RefreshToken.controller.js";
const router = Router();

router.route("/").post(refreshAccessToken);
export default router;
