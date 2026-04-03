import mongoose from "mongoose";

const PasswordActionTokenSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        tokenHash: {
            type: String,
            required: true,
            index: true,
            trim: true,
        },
        purpose: {
            type: String,
            enum: ["initial_password_change", "reset_password"],
            required: true,
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
        usedAt: {
            type: Date,
            default: null,
            index: true,
        },
        requestedIp: {
            type: String,
            default: null,
            trim: true,
        },
        requestedUserAgent: {
            type: String,
            default: null,
            trim: true,
        },
        requestedCity: {
            type: String,
            default: null,
            trim: true,
            maxlength: 120,
        },
        requestedLatitude: {
            type: Number,
            default: null,
            min: -90,
            max: 90,
        },
        requestedLongitude: {
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

PasswordActionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PasswordActionTokenSchema.index({ userId: 1, purpose: 1, usedAt: 1 });

export default mongoose.models.PasswordActionToken ||
    mongoose.model("PasswordActionToken", PasswordActionTokenSchema);