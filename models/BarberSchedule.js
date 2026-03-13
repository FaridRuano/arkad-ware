import mongoose from "mongoose";

const DAY_VALUES = [0, 1, 2, 3, 4, 5, 6];

const isValidTimeHHMM = (value = "") => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

const DayScheduleSchema = new mongoose.Schema(
  {
    day: {
      type: Number,
      required: true,
      enum: DAY_VALUES,
    },

    enabled: {
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

    breakStart: {
      type: String,
      default: "",
      validate: {
        validator(value) {
          if (!value) return true;
          return isValidTimeHHMM(value);
        },
        message: "La hora de inicio de descanso debe tener formato HH:MM",
      },
    },

    breakEnd: {
      type: String,
      default: "",
      validate: {
        validator(value) {
          if (!value) return true;
          return isValidTimeHHMM(value);
        },
        message: "La hora de fin de descanso debe tener formato HH:MM",
      },
    },
  },
  {
    _id: false,
  }
);

const BarberScheduleSchema = new mongoose.Schema(
  {
    barber: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      required: [true, "El barbero es obligatorio"],
      unique: true,
      index: true,
    },

    weekSchedule: {
      type: [DayScheduleSchema],
      default: () => [
        { day: 0, enabled: false, start: "", end: "", breakStart: "", breakEnd: "" },
        { day: 1, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
        { day: 2, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
        { day: 3, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
        { day: 4, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
        { day: 5, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
        { day: 6, enabled: true, start: "09:00", end: "14:00", breakStart: "", breakEnd: "" },
      ],
      validate: {
        validator(value) {
          if (!Array.isArray(value)) return false;
          if (value.length !== 7) return false;

          const days = value.map((item) => item.day);
          return DAY_VALUES.every((d) => days.includes(d));
        },
        message: "El horario semanal debe incluir exactamente los 7 días",
      },
    },

    useBusinessHoursAsFallback: {
      type: Boolean,
      default: true,
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

BarberScheduleSchema.pre("validate", function (next) {
  if (!Array.isArray(this.weekSchedule)) return next();

  this.weekSchedule = this.weekSchedule
    .map((item) => ({
      ...item,
      start: item?.start?.trim?.() || "",
      end: item?.end?.trim?.() || "",
      breakStart: item?.breakStart?.trim?.() || "",
      breakEnd: item?.breakEnd?.trim?.() || "",
    }))
    .sort((a, b) => a.day - b.day);

  for (const item of this.weekSchedule) {
    if (!item.enabled) {
      item.start = "";
      item.end = "";
      item.breakStart = "";
      item.breakEnd = "";
      continue;
    }

    if (!item.start || !item.end) {
      return next(new Error(`El día ${item.day} está habilitado pero no tiene horario completo`));
    }

    if (item.start >= item.end) {
      return next(new Error(`El horario del día ${item.day} no es válido: inicio debe ser menor que fin`));
    }

    const hasBreak = item.breakStart || item.breakEnd;

    if (hasBreak) {
      if (!item.breakStart || !item.breakEnd) {
        return next(new Error(`El descanso del día ${item.day} está incompleto`));
      }

      if (item.breakStart >= item.breakEnd) {
        return next(new Error(`El descanso del día ${item.day} no es válido`));
      }

      if (item.breakStart <= item.start || item.breakEnd >= item.end) {
        return next(
          new Error(`El descanso del día ${item.day} debe estar dentro del horario laboral`)
        );
      }
    }
  }

  next();
});

const BarberSchedule =
  mongoose.models.BarberSchedule ||
  mongoose.model("BarberSchedule", BarberScheduleSchema);

export default BarberSchedule;