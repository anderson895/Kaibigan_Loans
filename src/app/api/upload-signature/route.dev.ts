// Local development only (`npm run dev`). The `.dev.ts` extension is only routed in dev
// (see pageExtensions in next.config.ts); production uses functions/api/upload-signature.ts.
import { handleUploadSignature } from "@/server/uploadSignature";

export function POST(request: Request) {
  return handleUploadSignature(request, {
    FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  });
}
