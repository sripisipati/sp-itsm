import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    const configured = config.getOrThrow<string>("STORAGE_DIR");
    this.root = path.resolve(process.cwd(), configured);
  }

  async save(contents: Buffer, originalName: string): Promise<{ storageKey: string; size: number }> {
    await mkdir(this.root, { recursive: true });
    const extension = path.extname(originalName).toLowerCase().replace(/[^.\w]/g, "");
    const storageKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
    const fullPath = this.resolve(storageKey);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents);
    return { storageKey, size: contents.length };
  }

  open(storageKey: string): Readable {
    return createReadStream(this.resolve(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolve(storageKey));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
    }
  }

  private resolve(storageKey: string): string {
    if (!storageKey || storageKey.includes("..") || path.isAbsolute(storageKey)) {
      throw new NotFoundException("Attachment content was not found.");
    }
    const fullPath = path.resolve(this.root, storageKey);
    if (!fullPath.startsWith(this.root + path.sep) && fullPath !== this.root) {
      throw new NotFoundException("Attachment content was not found.");
    }
    return fullPath;
  }
}
