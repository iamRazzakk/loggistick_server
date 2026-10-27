import { Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ExportFile } from "../shared/tabularExport";

export const sendDownload = (res: Response, file: ExportFile) => {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${file.filename}"`,
  );
  res.status(StatusCodes.OK).send(file.buffer);
};
