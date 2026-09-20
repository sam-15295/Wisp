import * as z from "zod";

export const signupSchema = z.object({
    name : z.string()
    .trim()
    .min(3, "Length should be greater than equal to 3")
    .max(50, "Length cannot be greater than 50 chars"),

    age : z.number()
    .min(10, "Age should be greater than equal to 10")
    .max(100, "Age greater than 100 is not allowed").optional(),

    email : z.preprocess(
        (val)=>{
            return typeof val == "string" ? val.trim().toLowerCase() : "" 
        },
        z.email("Email is not valid")
    ),

    password : 
    z.string()
    .min(8, "Length should be atleast 8")
    .max(30)
    .regex(/[A-Z]/, "Atleast one uppercase character should be present")
    .regex(/[a-z]/, "Atleast one lowercase character should be present")
    .regex(/[0-9]/, "Atleast one number should be there")
    .regex(/[$#%&*!-~]/, "Password should have atleast one special character")
});

export const loginSchema = z.object({
    email : z.preprocess(
        (val)=>{
            return typeof val == "string" ? val.trim().toLowerCase() : ""
        },
        z.email("Email is not valid")
    ),

    password : 
    z.string()
    .min(8, "Length should be atleast 8")
    .max(30)
    .regex(/[A-Z]/, "Atleast one uppercase character should be present")
    .regex(/[a-z]/, "Atleast one lowercase character should be present")
    .regex(/[0-9]/, "Atleast one number should be there")
    .regex(/[$#%&*!-~]/, "Password should have atleast one special character")
})