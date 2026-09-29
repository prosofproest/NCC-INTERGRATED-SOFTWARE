/**
 * Secure file MIME type sniffer and binary content validator.
 * Validates real magic bytes, detects disguised executables, and validates size limits.
 */

export interface FileValidationResult {
  valid: boolean;
  sniffedMimeType: string | null;
  error?: string;
}

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

export const MIME_EXTENSIONS_MAP: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
};

/**
 * Sniffs the true MIME type from the binary buffer using magic byte signatures.
 */
export function sniffMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) {
    return null;
  }

  // 1. Check for malicious executables / binaries regardless of extension
  // DOS / PE executable header: "MZ"
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return "application/x-msdownload";
  }

  // Linux ELF binary header: "\x7FELF"
  if (
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    return "application/x-elf";
  }

  // macOS Mach-O binaries: 0xFEEDFACE, 0xFEEDFACF, 0xCAFEBABE
  if (
    (buffer[0] === 0xfe && buffer[1] === 0xed && buffer[2] === 0xfa) ||
    (buffer[0] === 0xce && buffer[1] === 0xfa && buffer[2] === 0xed) ||
    (buffer[0] === 0xcf && buffer[1] === 0xfa && buffer[2] === 0xed)
  ) {
    return "application/x-mach-binary";
  }

  // PDF signature: "%PDF-" (0x25 0x50 0x44 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "application/pdf";
  }

  // PNG signature: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG signature: 0xFF 0xD8 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // WebP signature: "RIFF" .... "WEBP"
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  // ZIP / OpenXML office formats (DOCX, XLSX): "PK\x03\x04"
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    // OpenXML check
    const contentStr = buffer.slice(0, 2000).toString("latin1");
    if (contentStr.includes("word/")) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (contentStr.includes("xl/")) {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    // Generic zip container
    return "application/zip";
  }

  return null;
}

/**
 * Validates a file against allowed extensions, real binary MIME sniffing, and size limits.
 * Explicitly guards against disguised executables and MIME spoofing.
 */
export function validateUploadedDocument(
  buffer: Buffer,
  fileName: string,
  declaredMimeType?: string,
  maxSizeBytes = MAX_DOCUMENT_SIZE_BYTES
): FileValidationResult {
  // 1. File size limit
  if (buffer.length === 0) {
    return {
      valid: false,
      sniffedMimeType: null,
      error: "Uploaded file is empty (0 bytes).",
    };
  }

  if (buffer.length > maxSizeBytes) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      sniffedMimeType: null,
      error: `File size (${sizeMb} MB) exceeds maximum allowed limit of ${maxMb} MB.`,
    };
  }

  // 2. Extension validation
  const extMatch = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  if (!extMatch) {
    return {
      valid: false,
      sniffedMimeType: null,
      error: "File must have a valid extension (e.g. .pdf, .jpg, .png, .docx, .xlsx).",
    };
  }
  const extension = extMatch[0];

  // 3. Sniff real binary magic bytes
  const sniffedMime = sniffMimeType(buffer);

  // Check for dangerous executables disguised with safe extensions
  if (
    sniffedMime === "application/x-msdownload" ||
    sniffedMime === "application/x-elf" ||
    sniffedMime === "application/x-mach-binary"
  ) {
    return {
      valid: false,
      sniffedMimeType: sniffedMime,
      error: `Security violation: Executable binary detected disguised as '${fileName}'. Upload rejected.`,
    };
  }

  // Handle PDF
  if (extension === ".pdf") {
    if (sniffedMime !== "application/pdf") {
      return {
        valid: false,
        sniffedMimeType: sniffedMime,
        error: `Content validation failed: File extension is '.pdf' but binary content does not match PDF format.`,
      };
    }
    return { valid: true, sniffedMimeType: "application/pdf" };
  }

  // Handle JPEG
  if (extension === ".jpg" || extension === ".jpeg") {
    if (sniffedMime !== "image/jpeg") {
      return {
        valid: false,
        sniffedMimeType: sniffedMime,
        error: `Content validation failed: File extension is '${extension}' but binary content does not match JPEG format.`,
      };
    }
    return { valid: true, sniffedMimeType: "image/jpeg" };
  }

  // Handle PNG
  if (extension === ".png") {
    if (sniffedMime !== "image/png") {
      return {
        valid: false,
        sniffedMimeType: sniffedMime,
        error: `Content validation failed: File extension is '.png' but binary content does not match PNG format.`,
      };
    }
    return { valid: true, sniffedMimeType: "image/png" };
  }

  // Handle WebP
  if (extension === ".webp") {
    if (sniffedMime !== "image/webp") {
      return {
        valid: false,
        sniffedMimeType: sniffedMime,
        error: `Content validation failed: File extension is '.webp' but binary content does not match WebP format.`,
      };
    }
    return { valid: true, sniffedMimeType: "image/webp" };
  }

  // Handle DOCX
  if (extension === ".docx") {
    if (
      sniffedMime !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
      sniffedMime !== "application/zip"
    ) {
      return {
        valid: false,
        sniffedMimeType: sniffedMime,
        error: `Content validation failed: File extension is '.docx' but binary content does not match Word document format.`,
      };
    }
    return {
      valid: true,
      sniffedMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  // Handle XLSX
  if (extension === ".xlsx") {
    if (
      sniffedMime !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
      sniffedMime !== "application/zip"
    ) {
      return {
        valid: false,
        sniffedMimeType: sniffedMime,
        error: `Content validation failed: File extension is '.xlsx' but binary content does not match Excel spreadsheet format.`,
      };
    }
    return {
      valid: true,
      sniffedMimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  return {
    valid: false,
    sniffedMimeType: sniffedMime,
    error: `Unsupported file format '${extension}'. Allowed formats: PDF, JPEG, PNG, WEBP, DOCX, XLSX.`,
  };
}
