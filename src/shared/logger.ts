import path from "path";
import colors from "colors";
import DailyRotateFile from "winston-daily-rotate-file";
const { createLogger, format, transports } = require("winston");
const { combine, timestamp, label, printf } = format;
colors.enable();
interface IMessageProps {
  level: string;
  message: string;
  label: string;
  timestamp: Date;
}
const paint = (level: string, line: string) => {
  if (level === "error") return colors.red(line);
  if (level === "warn") return colors.yellow(line);
  if (level === "info") return colors.green(line);
  if (level === "debug") return colors.blue(line);
  return line;
};
const formatLine = ({ level, message, label, timestamp }: IMessageProps) => {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  return `${date.toDateString()} ${hour}:${minutes}:${seconds} [${label}] ${level}: ${message}`;
};
const fileFormat = printf(formatLine);
const consoleFormat = printf((info: IMessageProps) =>
  paint(info.level, formatLine(info)),
);
const logger = createLogger({
  level:
    process.env.NODE_ENV === "production"
      ? "info"
      : process.env.LOG_LEVEL || "debug",
  transports: [
    new transports.Console({
      format: combine(
        label({ label: "Logistics-Server" }),
        timestamp(),
        consoleFormat,
      ),
    }),
    new DailyRotateFile({
      filename: path.join(
        process.cwd(),
        "winston",
        "success",
        "%DATE%-success.log",
      ),
      datePattern: "DD-MM-YYYY-HH",
      maxSize: "20m",
      maxFiles: "1d",
      format: combine(
        label({ label: "Logistics-Server" }),
        timestamp(),
        fileFormat,
      ),
    }),
  ],
});
const errorLogger = createLogger({
  level: "error",
  transports: [
    new transports.Console({
      format: combine(
        label({ label: "Logistics-Server" }),
        timestamp(),
        consoleFormat,
      ),
    }),
    new DailyRotateFile({
      filename: path.join(
        process.cwd(),
        "winston",
        "error",
        "%DATE%-error.log",
      ),
      datePattern: "DD-MM-YYYY-HH",
      maxSize: "20m",
      maxFiles: "1d",
      format: combine(
        label({ label: "Logistics-Server" }),
        timestamp(),
        fileFormat,
      ),
    }),
  ],
});
export { errorLogger, logger };
