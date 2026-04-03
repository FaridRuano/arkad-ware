import mongoose from "mongoose";

const UserAccessSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },
        firstLoginAt: {
            type: Date,
            default: Date.now,
        },
        lastLoginAt: {
            type: Date,
            default: Date.now,
        },
        loginCount: {
            type: Number,
            default: 1,
            min: 0,
        },
        lastLoginIp: {
            type: String,
            default: null,
            trim: true,
        },
        lastLoginUserAgent: {
            type: String,
            default: null,
            trim: true,
        },
        lastKnownCity: {
            type: String,
            default: null,
            trim: true,
            maxlength: 120,
        },
        lastKnownLatitude: {
            type: Number,
            default: null,
            min: -90,
            max: 90,
        },
        lastKnownLongitude: {
            type: Number,
            default: null,
            min: -180,
            max: 180,
        },
        passwordChangedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export default mongoose.models.UserAccess ||
    mongoose.model("UserAccess", UserAccessSchema);