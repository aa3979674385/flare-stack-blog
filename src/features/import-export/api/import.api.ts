import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GetProgressInputSchema } from "@/features/import-export/import-export.schema";
import * as ImportExportService from "@/features/import-export/import-export.service";
import { requirePermission } from "@/lib/middlewares";

const UploadForImportInputSchema = z.instanceof(FormData);

export const uploadForImportFn = createServerFn({
  method: "POST",
})
  .middleware([requirePermission("import.manage")])
  .inputValidator(UploadForImportInputSchema)
  .handler(async ({ data: formData, context }) => {
    const files = formData
      .getAll("file")
      .filter((f): f is File => f instanceof File);

    const result = await ImportExportService.startImport(context, files);
    return result;
  });

export const getImportProgressFn = createServerFn()
  .middleware([requirePermission("import.manage")])
  .inputValidator(GetProgressInputSchema)
  .handler(({ data, context }) =>
    ImportExportService.getImportProgress(context, data.taskId),
  );
