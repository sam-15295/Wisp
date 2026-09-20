import express from "express";
import authUserMiddleware from "../middlewares/authUserMiddleware.js";
import validateChatId from "../middlewares/validateObjectId.js";
import { getMessage, sendMessage } from "../controllers/messageController.js";
const messageRouter = express.Router();

messageRouter.use(authUserMiddleware);
messageRouter.param("chatId", validateChatId);


messageRouter.post("/", sendMessage);
messageRouter.get("/:chatId", getMessage);
messageRouter.post("/:chatId", sendMessage);

export default messageRouter;