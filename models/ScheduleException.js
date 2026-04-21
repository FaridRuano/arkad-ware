import mongoose from "mongoose";

const SCOPES = ["business", "barber"];
const TYPES = ["full_day", "time_range"];

const isValidTimeHHMM = (value = "") =>
  /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || "").trim());

const ScheduleExceptionSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: SCOPES,
      required: [true, "El alcance de la excepción es obligatorio"],
      index: true,
    },

    barberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      default: null,
      index: true,
    },

    type: {
      type: String,
      enum: TYPES,
      required: [true, "El tipo de excepción es obligatorio"],
    },

    startDate: {
      type: Date,
      required: [true, "La fecha inicial es obligatoria"],
      index: true,
    },

    endDate: {
      type: Date,
      required: [true, "La fecha final es obligatoria"],
      index: true,
    },

    startTime: {
      type: String,
      default: "",
      validate: {
        validator(value) {
          if (!value) return true;
          return isValidTimeHHMM(value);
        },
        message: "La hora inicial debe tener formato HH:MM",
      },
    },

    endTime: {
      type: String,
      default: "",
      validate: {
        validator(value) {
          if (!value) return true;
          return isValidTimeHHMM(value);
        },
        message: "La hora final debe tener formato HH:MM",
      },
    },

    reason: {
      type: String,
      trim: true,
      default: "",
      maxlength: [240, "La razón no puede superar los 240 caracteres"],
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    deactivatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    deactivatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

ScheduleExceptionSchema.index({ scope: 1, barberId: 1, startDate: 1, endDate: 1 });
ScheduleExceptionSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

ScheduleExceptionSchema.pre("validate", function (next) {
  try {
    this.startTime = String(this.startTime || "").trim();
    this.endTime = String(this.endTime || "").trim();
    this.reason = String(this.reason || "").trim();

    if (this.scope === "barber") {
      if (!this.barberId) {
        return next(new Error("barberId es obligatorio cuando el alcance es 'barber'"));
      }
    } else if (this.scope === "business") {
      this.barberId = null;
    }

    if (!this.startDate || Number.isNaN(new Date(this.startDate).getTime())) {
      return next(new Error("La fecha inicial no es válida"));
    }

    if (!this.endDate || Number.isNaN(new Date(this.endDate).getTime())) {
      return next(new Error("La fecha final no es válida"));
    }

    if (new Date(this.startDate).getTime() > new Date(this.endDate).getTime()) {
      return next(new Error("La fecha inicial no puede ser mayor que la fecha final"));
    }

    if (this.type === "full_day") {
      this.startTime = "";
      this.endTime = "";
      return next();
    }

    if (!this.startTime || !this.endTime) {
      return next(new Error("startTime y endTime son obligatorios en excepciones por rango"));
    }

    if (!isValidTimeHHMM(this.startTime) || !isValidTimeHHMM(this.endTime)) {
      return next(new Error("Las horas deben tener formato HH:MM"));
    }

    if (this.startTime >= this.endTime) {
      return next(new Error("La hora inicial debe ser menor que la hora final"));
    }

    next();
  } catch (error) {
    next(error);
  }
});

const ScheduleException =
  mongoose.models.ScheduleException ||
  mongoose.model("ScheduleException", ScheduleExceptionSchema);

export default ScheduleException;
