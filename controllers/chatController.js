import Chat from "../model/chatSchema.js";
import Message from "../model/messageSchema.js";
export const getRecentChat = async (req, res) =>{
    try{
        const chats = await Chat.find({userId : req.user._id})
        .select("topic updatedAt")
        .sort({updatedAt : -1})
        .limit(20);

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

        const chat = Chat.findOne({_id : chatId, userId : req.user._id});

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
            return res.status(403).json({
                message : "You are not allowed to do this"
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
