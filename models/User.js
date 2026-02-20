import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
    {
        // ✅ Estado de cuenta para controlar validaciones
        accountStatus: {
            type: String,
            enum: ["draft", "active"],
            default: "draft",
            index: true,
        },

        // ✅ Identificación: puede ser null al inicio, única si existe
        cedula: {
            type: String,
            trim: true,
            default: null,
        },

        firstName: {
            type: String,
            required: true,
            trim: true,
        },

        // Para quick-create puedes permitir vacío y luego completar
        lastName: {
            type: String,
            trim: true,
            default: "",
        },

        email: {
            type: String,
            lowercase: true,
            trim: true,
            default: null,
        },

        phone: {
            type: String,
            trim: true,
            default: null,
        },

        // ✅ Solo obligatoria cuando la cuenta está activa
        address: {
            type: String,
            trim: true,
            default: null,
            required: function () {
                return this.accountStatus === "active";
            },
        },

        // ✅ Password: si está en draft, puede no existir.
        // Cuando pasas a active, ya deberías setearlo (ej: cedula) y permitir reset.
        password: {
            type: String,
            select: false,
            default: null,
            required: function () {
                return this.accountStatus === "active";
            },
        },

        emailVerified: {
            type: Date,
            default: null,
        },

        // ✅ Terms solo cuando está active
        terms: {
            acceptedAt: {
                type: Date,
                default: null,
                required: function () {
                    return this.accountStatus === "active";
                },
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

        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
            index: true,
        },

        // ✅ Marcador útil para tu UI (chips, filtros, “completar perfil”)
        isProfileComplete: {
            type: Boolean,
            default: false,
            index: true,
        },
    },
    { timestamps: true }
);

// ✅ Índices únicos seguros (solo si existe valor)
UserSchema.index({ cedula: 1 }, { unique: true, sparse: true });
UserSchema.index({ email: 1 }, { unique: true, sparse: true });
// Si quieres que phone sea único:
UserSchema.index({ phone: 1 }, { unique: true, sparse: true });

const User = mongoose.models?.User || mongoose.model("User", UserSchema);
export default User;