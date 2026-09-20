import express from "express";
import authUserMiddleware from "../middlewares/authUserMiddleware.js";
import validateChatId from "../middlewares/validateObjectId.js";
import { getMessage, sendMessage, streamMessage } from "../controllers/messageController.js";
const messageRouter = express.Router();

messageRouter.use(authUserMiddleware);
messageRouter.param("chatId", validateChatId);


messageRouter.post("/", sendMessage);
// fixed paths stay above "/:chatId", otherwise "stream" would be read as a chat id
messageRouter.post("/stream", streamMessage);
messageRouter.post("/:chatId/stream", streamMessage);
messageRouter.get("/:chatId", getMessage);
messageRouter.post("/:chatId", sendMessage);

export default messageRouter;