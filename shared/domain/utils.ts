export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export const round = (value: number, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const scaleBetween = (
  value: number,
  inputMin: number,
  inputMax: number,
  outputMin: number,
  outputMax: number
) => {
  if (inputMin === inputMax) {
    return outputMin;
  }

  const progress = (value - inputMin) / (inputMax - inputMin);
  return outputMin + progress * (outputMax - outputMin);
};

export const interpolateClamped = (
  value: number,
  inputMin: number,
  inputMax: number,
  outputMin: number,
  outputMax: number
) => clamp(scaleBetween(value, inputMin, inputMax, outputMin, outputMax), Math.min(outputMin, outputMax), Math.max(outputMin, outputMax));

export const daysBetween = (laterIso: string, earlierIso: string) => {
  const later = new Date(laterIso).getTime();
  const earlier = new Date(earlierIso).getTime();
  return Math.max(0, Math.floor((later - earlier) / 86_400_000));
};

export const isoDateKey = (isoString: string) => isoString.slice(0, 10);
export const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const pad2 = (value: number) => value.toString().padStart(2, "0");

export const localDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const detectTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const dateKeyInTimeZone = (value: Date | string, timeZone: string) => {
  const date = typeof value === "string" ? new Date(value) : value;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
};

const dateKeyToUtcMs = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day, 12, 0, 0, 0);
};

export const dayDifferenceInTimeZone = (laterValue: Date | string, earlierValue: Date | string, timeZone: string) => {
  const laterKey =
    typeof laterValue === "string" && isDateKey(laterValue) ? laterValue : dateKeyInTimeZone(laterValue, timeZone);
  const earlierKey =
    typeof earlierValue === "string" && isDateKey(earlierValue)
      ? earlierValue
      : dateKeyInTimeZone(earlierValue, timeZone);

  return Math.max(0, Math.floor((dateKeyToUtcMs(laterKey) - dateKeyToUtcMs(earlierKey)) / 86_400_000));
};
