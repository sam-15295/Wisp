import * as z from "zod";

const emailSchema = z.preprocess(
    (val)=>{
        return typeof val == "string" ? val.trim().toLowerCase() : ""
    },
    z.email("Email is not valid")
);

export const signupSchema = z.object({
    name : z.string()
    .trim()
    .min(3, "Length should be greater than equal to 3")
    .max(50, "Length cannot be greater than 50 chars"),

    age : z.number()
    .min(10, "Age should be greater than equal to 10")
    .max(100, "Age greater than 100 is not allowed").optional(),

    email : emailSchema,

    // any character that is not a letter or digit counts as special
    password :
    z.string()
    .min(8, "Length should be atleast 8")
    .max(30, "Length cannot be greater than 30 chars")
    .regex(/[A-Z]/, "Atleast one uppercase character should be present")
    .regex(/[a-z]/, "Atleast one lowercase character should be present")
    .regex(/[0-9]/, "Atleast one number should be there")
    .regex(/[^A-Za-z0-9]/, "Password should have atleast one special character")
});

// login only checks that a password was sent, the strength rules are for signup
export const loginSchema = z.object({
    email : emailSchema,

    password : z.string().min(1, "Password is required")
})
