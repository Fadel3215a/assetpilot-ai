const EMPTY_FILE_MESSAGE = "The selected file is empty. Choose a file with content.";
const PROCESSING_FAILED_MESSAGE = "Could not process this file. Try a different format.";

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateUploadFile(file: File): UploadValidationResult {
  if (file.size === 0) {
    return { ok: false, message: EMPTY_FILE_MESSAGE };
  }
  return { ok: true };
}

export function uploadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return PROCESSING_FAILED_MESSAGE;
}
