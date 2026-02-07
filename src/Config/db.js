import mongoose from "mongoose";
import { DB_Name } from "./dbName.js";

export const connectDB = async () => {
  try {
    const instanceConnection = await mongoose.connect(
      `${process.env.MONGODB_URI}${DB_Name}`
    );
    console.log(`MongoDB connected: ${instanceConnection.connection.host}`);
  } catch (error) {
    console.log("MONGODB connection FAILED ", error);
    process.exit(1);
  }
};
