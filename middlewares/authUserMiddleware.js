import jwt from "jsonwebtoken";
import User from "../model/userSchema.js";


const authUserMiddleware = async (req, res, next)=>{
    try{
        const {token} = req.cookies;

        if(!token){
            return res.status(401).json({
                message : "Login first"
            });
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        const existingUser = await User.findById(payload.id);

        if(!existingUser){
            return res.status(401).json({
                message : "User Doesnt Exist"
            });
        }

        req.user = existingUser;
        next();
    }
    catch(err){
        // a bad or expired token is the client's problem (401), not a server error (500)
        if(err.name === "TokenExpiredError" || err.name === "JsonWebTokenError"){
            return res.status(401).json({
                message : "Session expired, please login again"
            });
        }
        console.log(err);
        res.status(500).json({message : "Internal Server Error"});
    }
}

export default authUserMiddleware;
