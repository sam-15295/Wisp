import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  age: {
    type: Number,
    min : 10,
    max : 100
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  password: {
    type: String,
    required: true
  },

  usage: {
    tokenUsed: {
      type: Number,
      default: 0
    },

    // TOKEN_LIMIT from .env, read when the user is created (a function so dotenv has already run)
    tokenLimit: {
      type: Number,
      default: () => Number(process.env.TOKEN_LIMIT) || 10000
    },

    resetAt: {
      type: Date,
      default: () => new Date(Date.now() + (Number(process.env.TOKEN_WINDOW_HOURS) || 5) * 60 * 60 * 1000)
    },

    totalTokenUsed: {
      type: Number,
      default: 0
    }
  }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

export default User;