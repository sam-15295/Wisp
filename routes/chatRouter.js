import express from "express";
import authUserMiddleware from "../middlewares/authUserMiddleware.js";
import {getRecentChat, createChat, getSingleChat, deleteChat} from "../controllers/chatController.js";


const chatRouter = express.Router();

chatRouter.use(authUserMiddleware);

chatRouter.get("/getRecentChat", getRecentChat);
chatRouter.post("/createChat", createChat);
chatRouter.get("/:chatId", getSingleChat);
chatRouter.delete("/:chatId", deleteChat);

export default chatRouter;