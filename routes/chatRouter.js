import express from "express";
import authUserMiddleware from "../middlewares/authUserMiddleware.js";
import validateChatId from "../middlewares/validateObjectId.js";
import {getRecentChat, createChat, getSingleChat, deleteChat, getModels} from "../controllers/chatController.js";


const chatRouter = express.Router();

chatRouter.use(authUserMiddleware);
chatRouter.param("chatId", validateChatId);

// fixed paths must stay above "/:chatId", otherwise "models" would be read as a chat id
chatRouter.get("/models", getModels);
chatRouter.get("/getRecentChat", getRecentChat);
chatRouter.post("/createChat", createChat);
chatRouter.get("/:chatId", getSingleChat);
chatRouter.delete("/:chatId", deleteChat);

export default chatRouter;