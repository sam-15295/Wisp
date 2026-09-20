import mongoose from "mongoose";

// used with router.param("chatId", validateChatId) so every :chatId route is checked once
const validateChatId = (req, res, next, chatId)=>{
    if(!mongoose.Types.ObjectId.isValid(chatId)){
        return res.status(400).json({
            message : "Invalid chat id"
        });
    }
    next();
}

export default validateChatId;
