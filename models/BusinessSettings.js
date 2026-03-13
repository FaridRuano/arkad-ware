import mongoose from "mongoose";

const isValidTimeHHMM = (value = "") => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

const TimeRangeSchema = new mongoose.Schema(
  {
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
  },
  { _id: false }
);

const BusinessSettingsSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      trim: true,
      default: "",
      maxlength: [120, "El nombre del negocio no puede superar los 120 caracteres"],
    },

    timezone: {
      type: String,
      trim: true,
      default: "America/Guayaquil",
    },

    generalSchedule: {
      weekdays: {
        type: TimeRangeSchema,
        default: {
          enabled: true,
          start: "09:00",
          end: "18:00",
        },
      },

      saturday: {
        type: TimeRangeSchema,
        default: {
          enabled: true,
          start: "09:00",
          end: "14:00",
        },
      },

      sunday: {
        type: TimeRangeSchema,
        default: {
          enabled: false,
          start: "",
          end: "",
        },
      },
    },

    slotIntervalMinutes: {
      type: Number,
      default: 30,
      min: [30, "El intervalo mínimo es 30 minutos"],
      validate: {
        validator: Number.isInteger,
        message: "El intervalo debe ser un número entero",
      },
    },

    bookingMinNoticeMinutes: {
      type: Number,
      default: 60,
      min: [0, "La anticipación mínima no puede ser negativa"],
      validate: {
        validator: Number.isInteger,
        message: "La anticipación mínima debe ser un número entero",
      },
    },

    bookingMaxDaysAhead: {
      type: Number,
      default: 30,
      min: [1, "El máximo de días para reservar debe ser al menos 1"],
      validate: {
        validator: Number.isInteger,
        message: "El máximo de días debe ser un número entero",
      },
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

BusinessSettingsSchema.pre("validate", function (next) {
  const ranges = [
    this.generalSchedule?.weekdays,
    this.generalSchedule?.saturday,
    this.generalSchedule?.sunday,
  ];

  for (const range of ranges) {
    if (!range) continue;

    if (!range.enabled) {
      range.start = "";
      range.end = "";
      continue;
    }

    if (!range.start || !range.end) {
      return next(new Error("Los horarios habilitados deben tener inicio y fin"));
    }

    if (range.start >= range.end) {
      return next(new Error("La hora de inicio debe ser menor que la de cierre"));
    }
  }

  next();
});

const BusinessSettings =
  mongoose.models.BusinessSettings ||
  mongoose.model("BusinessSettings", BusinessSettingsSchema);

export default BusinessSettings;