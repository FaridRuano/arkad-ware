import mongoose from "mongoose";

const isValidTimeHHMM = (value = "") => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

const ScheduleExceptionSchema = new mongoose.Schema(
    {
        barber: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Barber",
            default: null,
            index: true,
        },

        date: {
            type: String,
            required: [true, "La fecha es obligatoria"],
            validate: {
                validator(value) {
                    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
                },
                message: "La fecha debe tener formato YYYY-MM-DD",
            },
            index: true,
        },

        type: {
            type: String,
            required: [true, "El tipo de excepción es obligatorio"],
            enum: {
                values: ["open", "block"],
                message: "El tipo de excepción debe ser 'open' o 'block'",
            },
        },

        allDay: {
            type: Boolean,
            default: false,
        },

        start: {
            type: String,
            default: "",
            validate: {
                validator(value) {
                    if (!value) return true;
                    return isValidTimeHHMM(value);
                },
                message: "La hora de inicio debe tener formato HH:MM",
            },
        },

        end: {
            type: String,
            default: "",
            validate: {
                validator(value) {
                    if (!value) return true;
                    return isValidTimeHHMM(value);
                },
                message: "La hora de fin debe tener formato HH:MM",
            },
        },

        reason: {
            type: String,
            trim: true,
            default: "",
            maxlength: [200, "La razón no puede superar los 200 caracteres"],
        },

        notes: {
            type: String,
            trim: true,
            default: "",
            maxlength: [300, "Las notas no pueden superar los 300 caracteres"],
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

ScheduleExceptionSchema.index({ barber: 1, date: 1 });
ScheduleExceptionSchema.index({ date: 1, type: 1 });

ScheduleExceptionSchema.pre("validate", function (next) {
    const hasTimeRange = Boolean(this.start || this.end);

    if (this.allDay) {
        this.start = "";
        this.end = "";
        return next();
    }

    if (hasTimeRange) {
        if (!this.start || !this.end) {
            return next(
                new Error("La excepción debe tener hora de inicio y fin completas")
            );
        }

        if (!isValidTimeHHMM(this.start) || !isValidTimeHHMM(this.end)) {
            return next(
                new Error("Las horas de la excepción deben tener formato HH:MM")
            );
        }

        if (this.start >= this.end) {
            return next(
                new Error("La hora de inicio debe ser menor que la hora de fin")
            );
        }
    } else {
        return next(
            new Error("La excepción debe ser de día completo o tener un rango horario")
        );
    }

    next();
});

const ScheduleException =
    mongoose.models.ScheduleException ||
    mongoose.model("ScheduleException", ScheduleExceptionSchema);

export default ScheduleException;