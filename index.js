import express from "express";
import helmet from "helmet";
import connectDB from "./config/database.js";
import dotenv from "dotenv";
import userRouter from "./routes/userRouter.js";
import cookieParser from "cookie-parser";
import chatRouter from "./routes/chatRouter.js";
import messageRouter from "./routes/messageRouter.js";

dotenv.config();

const app = express();

// security headers (no X-Powered-By, no MIME sniffing, ...)
app.use(helmet());
// a chat message is at most 4000 characters, a small body limit stops oversized requests early
app.use(express.json({limit : "20kb"}));
app.use(cookieParser());

app.use("/user", userRouter);
app.use("/msg", messageRouter);
app.use("/chat", chatRouter);

// last middleware: malformed JSON bodies should get a JSON 400, not Express's default HTML page
app.use((err, req, res, next)=>{
    if(err.type === "entity.parse.failed"){
        return res.status(400).json({
            message : "Invalid JSON body"
        });
    }
    if(err.type === "entity.too.large"){
        return res.status(413).json({
            message : "Request body is too large"
        });
    }
    console.log(err);
    res.status(500).json({
        message : "Internal Server Error"
    });
});

const startServer = async ()=>{
    try{
        await connectDB();
        app.listen(process.env.PORT, ()=>{
            console.log(`Server has started listening at port ${process.env.PORT}`);
        });
    }
    catch(err){
        console.log(err);
    }
}

startServer();

//model folder --> all the models are placed here
//config folder --> all the external connections are made here