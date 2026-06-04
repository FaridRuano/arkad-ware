import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema(
    {
        serviceType: {
            type: String,
            enum: ["single", "package"],
            default: "single",
            index: true,
        },

        name: {
            type: String,
            required: [true, "El nombre del servicio es obligatorio"],
            trim: true,
            maxlength: [120, "El nombre no puede superar los 120 caracteres"],
        },

        description: {
            type: String,
            trim: true,
            maxlength: [300, "La descripción no puede superar los 300 caracteres"],
            default: "",
        },

        durationMinutes: {
            type: Number,
            required: [true, "La duración es obligatoria"],
            min: [5, "La duración mínima es de 5 minutos"],
            validate: {
                validator: Number.isInteger,
                message: "La duración debe ser un número entero de minutos",
            },
        },

        price: {
            type: Number,
            required: [true, "El precio es obligatorio"],
            min: [0, "El precio no puede ser negativo"],
        },

        barbers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Barber",
            },
        ],
        packageItems: [
            {
                service: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Service",
                    required: true,
                },
                order: {
                    type: Number,
                    required: true,
                    min: 1,
                },
            },
        ],
        discountType: {
            type: String,
            enum: ["amount", "percent"],
            default: "amount",
        },
        discountValue: {
            type: Number,
            min: [0, "El descuento no puede ser negativo"],
            default: 0,
        },
        color: {
            type: String,
            default: "#CFB690",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

const Service =
    mongoose.models.Service || mongoose.model("Service", ServiceSchema);

export default Service;
