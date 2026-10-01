import type { OcrResult } from "@/domain/Payment";
import { ReceiptParser } from "@/domain/ReceiptParser";

/** Reads receipt screenshots in the browser with tesseract.js (loaded lazily, only when needed). */
export class OcrService {
  constructor(private readonly parser = new ReceiptParser()) {}

  async readReceipt(file: File): Promise<OcrResult> {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const { data } = await worker.recognize(file);
      return this.parser.parse(data.text);
    } finally {
      await worker.terminate();
    }
  }
}
