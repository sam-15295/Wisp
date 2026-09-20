import rateLimit from "express-rate-limit";

// Brute-force protection for login and signup: one IP address may fail only a few times in a time window.
// skipSuccessfulRequests means a normal user who logs in correctly never uses up the allowance,
// only wrong passwords (401), bad input (400) and duplicate emails (409) are counted.
export const authRateLimiter = rateLimit({
    windowMs : (Number(process.env.AUTH_RATE_WINDOW_MINUTES) || 15) * 60 * 1000,
    limit : Number(process.env.AUTH_RATE_LIMIT) || 10,
    skipSuccessfulRequests : true,
    standardHeaders : "draft-7",
    legacyHeaders : false,
    handler : (req, res)=>{
        res.status(429).json({
            message : "Too many failed attempts, please try again later"
        });
    }
});
