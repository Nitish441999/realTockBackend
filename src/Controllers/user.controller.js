import { Message } from "../Models/message.model.js";
import { User } from "../Models/user.model.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { uploadOnCloudinary } from "../Utils/Cloudinary.js";
import { sendEmail } from "../Utils/sendEmail.js";

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000);

const addUser = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const otp = generateOTP();

  let user = await User.findOne({ email });

  if (!user) {
    if (!fullName) {
      throw new ApiError(400, "Full name is required for new user");
    }

    let avatarUrl = "";

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    if (avatarLocalPath) {
      const uploadResult = await uploadOnCloudinary(avatarLocalPath);
      avatarUrl = uploadResult?.url || "";
    }

    user = await User.create({
      fullName,
      email,
      avatar: avatarUrl,
      otp,
    });
  } else {
    user.otp = otp;
    await user.save();
  }

  await sendEmail({
    to: email,
    subject: "🔐 Verify Your Login – One Time Password (OTP)",
    html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color:#333;">OTP Verification</h2>

      <p>Hello,</p>

      <p>
        You requested to log in to your <b>RealTalk</b> account. Please use the OTP below to
        complete your verification:
      </p>

      <div style="
        background:#f4f6f8;
        padding:15px;
        font-size:22px;
        font-weight:bold;
        text-align:center;
        letter-spacing:4px;
        border-radius:6px;
        margin:20px 0;
      ">
        ${otp}
      </div>

      <p>
        This OTP is valid for a <b>limited time</b>. Please do not share this
        code with anyone for security reasons.
      </p>

      <p>
        If you did not request this login, you can safely ignore this email.
      </p>

      <p style="margin-top:30px;">
        Thanks,<br />
        <b>RealTalk Team</b>
      </p>

      <hr style="margin-top:30px;" />

      <p style="font-size:12px; color:#777;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  `,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, user, "OTP sent successfully"));
});

const otpVerify = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  if (user.otp !== Number(otp)) {
    throw new ApiError(401, "Invalid OTP");
  }
  user.otp = null;

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  user.refreshToken = refreshToken;
  await user.save();

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 1 * 24 * 60 * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, user, "OTP verified successfully"));
});

const getAllUsers = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;

  const users = await User.find({
    _id: { $ne: currentUserId },
  }).select(" -refreshToken -otp");

  if (!users) {
    throw new ApiError(404, " All users not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, users, "get All Users successfully "));
});

const getMe = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  res.status(200).json(new ApiResponse(200, user, "User authenticated"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, " Apload your image");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading avatar");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password -otp -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});
export { addUser, otpVerify, getMe, getAllUsers, updateUserAvatar };
