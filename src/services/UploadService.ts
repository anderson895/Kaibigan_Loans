import type { AuthService } from "./AuthService";

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

  async uploadReceipt(file: File): Promise<UploadedFile> {
    if (!file.type.startsWith("image/")) throw new Error("Image files lang ang pwede (screenshot ng resibo).");
    if (file.size > UploadService.MAX_BYTES) throw new Error("Masyadong malaki ang file (max 8MB).");

    const res = await fetch("/api/upload-signature", {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.authService.idToken()}` },
    });
    if (!res.ok) throw new Error(`Hindi ma-upload (${res.status}). Subukang mag-login ulit.`);
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
