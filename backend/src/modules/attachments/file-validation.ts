import { BadRequestException } from "@nestjs/common";

const EXTENSION_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function assertSafeUpload(file: { originalname: string; mimetype: string; size: number; buffer: Buffer }, maxBytes: number, allowedMime: string[]): void {
  if (!file.buffer || file.size <= 0) {
    throw new BadRequestException("The uploaded file is empty.");
  }
  if (file.size > maxBytes) {
    throw new BadRequestException("The uploaded file exceeds the allowed size.");
  }
  const extension = file.originalname.includes(".") ? file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase() : "";
  const expected = EXTENSION_MIME[extension];
  if (!expected || !allowedMime.includes(expected) || file.mimetype !== expected) {
    throw new BadRequestException("This file type is not allowed.");
  }
  if (!matchesSignature(extension, file.buffer)) {
    throw new BadRequestException("The file contents do not match the declared file type.");
  }
}

function matchesSignature(extension: string, buffer: Buffer): boolean {
  if (extension === ".png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === ".jpg" || extension === ".jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (extension === ".pdf") return buffer.subarray(0, 4).toString("utf8") === "%PDF";
  if (extension === ".docx") return buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (extension === ".txt" || extension === ".csv" || extension === ".json") return !buffer.includes(0);
  return false;
}
