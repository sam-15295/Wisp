import express from "express";
import {login, signup, profile, logout, deleteAccount} from "../controllers/userController.js";
import authUserMiddleware from "../middlewares/authUserMiddleware.js";
import {authRateLimiter} from "../middlewares/rateLimiter.js";


const userRouter = express.Router();

userRouter.post("/login", authRateLimiter, login);
userRouter.post("/logout", logout);
userRouter.post("/signup", authRateLimiter, signup);
userRouter.get("/profile", authUserMiddleware, profile);
userRouter.delete("/delete", authUserMiddleware, deleteAccount);


export default userRouter;

