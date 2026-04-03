import mongoose from "mongoose";

const UserLoginEventSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        loggedAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
        ip: {
            type: String,
            default: null,
            trim: true,
        },
        userAgent: {
            type: String,
            default: null,
            trim: true,
        },
        city: {
            type: String,
            default: null,
            trim: true,
            maxlength: 120,
        },
        latitude: {
            type: Number,
            default: null,
            min: -90,
            max: 90,
        },
        longitude: {
            type: Number,
            default: null,
            min: -180,
            max: 180,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

UserLoginEventSchema.index({ userId: 1, loggedAt: -1 });

export default mongoose.models.UserLoginEvent ||
    mongoose.model("UserLoginEvent", UserLoginEventSchema);