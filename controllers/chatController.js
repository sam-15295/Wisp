import Chat from "../model/chatSchema.js";
import Message from "../model/messageSchema.js";
import {getAllowedModels, isModelAllowed} from "../config/models.js";

export const getModels = async (req, res) =>{
    res.status(200).json({
        models : getAllowedModels(),
        defaultModel : process.env.DEFAULT_AI_MODEL
    });
}

export const getRecentChat = async (req, res) =>{
    try{
        const chats = await Chat.find({userId : req.user._id})
        .select("topic updatedAt")
        .sort({updatedAt : -1})
        .limit(50);

        res.status(200)
        .json({
            message : "Your all recent chats",
            chats
        })
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        })
    }
}

export const getSingleChat = async (req, res) =>{
    try{
        const {chatId} = req.params;

        const chat = await Chat.findOne({_id : chatId, userId : req.user._id});

        if(!chat){
            return res.status(404)
            .json({
                message : "Sorry, no data found"
            })
        }
        return res.status(200)
        .json({
            chatId : chat._id,
            userId : chat.userId,
            topic : chat.topic,
            model : chat.model,
            messageCount : chat.messageCount,
            usage : chat.usage
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        })
    }
}


export const createChat = async (req, res) =>{
    try{
        const {model} = req.body;

        if(!model){
            return res.status(400).json({
                message : "Model name is missing"
            })
        }

        if(!isModelAllowed(model)){
            return res.status(400).json({
                message : "This model is not allowed"
            })
        }


        const chats = await Chat.create({
            userId : req.user._id,
            model
        });

        res.status(201)
        .json({
            chatId : chats._id,
            userId : req.user._id,
            model,
            topic : chats.topic,
            createdAt : chats.createdAt,
            message : "Chat created"
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        })
    }
}

export const deleteChat = async (req, res) =>{
    try{
         const {chatId} = req.params;

         const chat = await Chat.findOne({_id : chatId, userId : req.user._id});

         if(!chat){
            return res.status(404).json({
                message : "Chat Not Found"
            })
         }

         await Message.deleteMany({
            chatId : chat._id
         });

         await Chat.deleteOne({
            _id : chatId
         });

         res.status(200).json({
            message : "Your chat deleted successfully"
         })
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        })
    }
}

export const renameChat = async (req, res) =>{
    try{
        const {chatId} = req.params;
        const {topic} = req.body;

        if(typeof topic !== "string" || topic.trim() === ""){
            return res.status(400).json({
                message : "Chat name is required"
            })
        }

        if(topic.trim().length > 60){
            return res.status(400).json({
                message : "Chat name cannot be longer than 60 characters"
            })
        }

        // the userId in the filter makes sure nobody can rename someone else's chat
        const chat = await Chat.findOneAndUpdate(
            {_id : chatId, userId : req.user._id},
            {topic : topic.trim()},
            {returnDocument : "after"}
        );

        if(!chat){
            return res.status(404).json({
                message : "Chat Not Found"
            })
        }

        res.status(200).json({
            message : "Chat renamed",
            chatId : chat._id,
            topic : chat.topic
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        })
    }
}
