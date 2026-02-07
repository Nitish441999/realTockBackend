import { Router } from "express";
import {
  addUser,
  getAllUsers,
  getMe,
  otpVerify,
  updateUserAvatar,
} from "../Controllers/user.controller.js";
import { verifyJWT } from "../Middlewares/auth.middleware.js";
import { upload } from "../Middlewares/multer.middleware.js";

const router = Router();

router.route("/").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
  ]),
  addUser
);
router.route("/verify").post(otpVerify);
router.use(verifyJWT);
router.route("/").get(getAllUsers);
router.route("/me").get(getMe);
router
  .route("/avatar")
  .patch(verifyJWT, upload.single("avatar"), updateUserAvatar);

export default router;
