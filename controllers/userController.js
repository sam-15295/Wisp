import User from "../model/userSchema.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import {signupSchema, loginSchema} from "../validators/userValidator.js";
import Chat from "../model/chatSchema.js";
import Message from "../model/messageSchema.js";

const createToken = (id, email)=>{
    if(!process.env.JWT_SECRET){
        throw new Error("JWT Secret key is missing");
    }

    const token = jwt.sign({id, email}, process.env.JWT_SECRET, {expiresIn : "1h"});
    return token;
}

// secure cookies need https, so they are switched on only in production
const cookiesOption = {
    httpOnly : true,
    secure : process.env.NODE_ENV === "production",
    sameSite : "lax",
    maxAge : 60*60*1000
}

const clearCookiesOption = {
    httpOnly : true,
    secure : process.env.NODE_ENV === "production",
    sameSite : "lax"
}

export const signup = async (req, res)=>{
    try{
        const result = signupSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message
            })
        }
        const {name, age, email, password} = result.data;
       
        const user = await User.findOne({email});

        if(user){
            return res.status(409).json({
                message : "Email Id already exist"
            })
        }

        const hashPassword = await bcrypt.hash(password, 12);

        const userCreated = await User.create({
            name,
            age,
            email,
            password : hashPassword
        });

        const token = createToken(userCreated._id, email);

        res.cookie("token", token, cookiesOption);

        res.status(201).json({
            message : "User created Successfully",
            name,
            age,
            email
        });

    }
    catch(err){
        // two signups with the same email can both pass findOne, the unique index stops the second one
        if(err.code === 11000){
            return res.status(409).json({
                message : "Email Id already exist"
            })
        }
        console.log(err);
        return res.status(500).json({
            message : "Internal Server error"
        })
    }
}

export const login = async (req, res)=>{
    try{
        const result = loginSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message
            })
        }

        const {password, email} = result.data;

        const existingUser = await User.findOne({email});

        if(!existingUser){
            return res.status(401).json({
                message : "Invalid Credentials"
            })
        }

        const isMatch = await bcrypt.compare(password, existingUser.password);

        if(!isMatch){
            return res.status(401).json({
                message : "Invalid Credentials"
            })
        }

        const token = createToken(existingUser._id, email);

        res.cookie("token", token, cookiesOption);

        res.status(200).json({
            message : "User Logged in Successfully",
            name : existingUser.name,
            age : existingUser.age,
            email : existingUser.email,
            usage : existingUser.usage
        });


    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}

export const logout = async (req, res)=>{
    res.clearCookie("token", clearCookiesOption);

    res.status(200).json({
        message : "User Logged Out Successfully"
    })
}

export const profile = async (req, res)=>{
    try{
        
        return res.status(200).json({
            name : req.user.name,
            age : req.user.age,
            usage : req.user.usage,
            email : req.user.email
        });

    }
    catch(err){
        console.log(err);
        return res.status(500).json({
            message : "Internal Server Error"
        })
    }
    
}

export const deleteAccount = async (req, res) => {
    try {
        // find all the chatId which belong to user
         const userId = req.user._id;

         // every message stores its owner, so no need to look up the chat ids first
         await Message.deleteMany({
            userId
         });

         await Chat.deleteMany({
            userId
         });

         await User.deleteOne({
            _id : userId
         });

         res.clearCookie("token", clearCookiesOption);

         res.status(200).json({
            message : "Account deleted successfully"
         });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error!"
        })
    }
}
