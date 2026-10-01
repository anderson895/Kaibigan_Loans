import type { AuthService } from "./AuthService";

export type UploadKind = "receipts" | "disbursements";

export interface UploadedFile {
  url: string;
  publicId: string;
}

interface SignatureResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

/** Signed Cloudinary uploads: the API secret never leaves the server route. */
export class UploadService {
  static readonly MAX_BYTES = 8 * 1024 * 1024;

  constructor(private readonly authService: AuthService) {}

  /** `kind` picks the Cloudinary folder: borrower payment receipts or the lender's proof of send. */
  async uploadReceipt(file: File, kind: UploadKind = "receipts"): Promise<UploadedFile> {
    if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed (receipt screenshot).");
    if (file.size > UploadService.MAX_BYTES) throw new Error("File is too large (max 8MB).");

    const res = await fetch("/api/upload-signature", {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.authService.idToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status}). Try logging in again.`);
    const sig = (await res.json()) as SignatureResponse;

    const form = new FormData();
    form.append("file", file);
    form.append("api_key", sig.apiKey);
    form.append("timestamp", String(sig.timestamp));
    form.append("folder", sig.folder);
    form.append("signature", sig.signature);

    const upload = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });
    const data = (await upload.json()) as { secure_url?: string; public_id?: string; error?: { message: string } };
    if (!upload.ok || !data.secure_url) throw new Error(data.error?.message ?? "Upload failed");
    return { url: data.secure_url, publicId: data.public_id! };
  }
}
