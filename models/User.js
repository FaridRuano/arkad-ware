import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
    {
        cedula: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            match: [/^\d{10}$/, "La cédula debe tener 10 dígitos"],
        },

        firstName: {
            type: String,
            required: true,
            trim: true,
        },

        lastName: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        phone: {

            type: String,
            required: true,
            trim: true,
        },

        address: {
            type: String,
            required: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
            select: false, // no se devuelve por defecto
        },

        emailVerified: {
            type: Date,
            default: null, // mejor que boolean para futuro (verificación real)
        },

        terms: {
            acceptedAt: {
                type: Date,
                required: true,
            },
            version: {
                type: String,
                default: "v1.0",
            },
        },

        lastLoginAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const User = mongoose.models?.User || mongoose.model("User", UserSchema);
export default User;
