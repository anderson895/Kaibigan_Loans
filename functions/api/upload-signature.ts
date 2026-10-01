// Cloudflare Pages Function: POST /api/upload-signature
// Vars come from wrangler.jsonc ("vars"); the Cloudinary key/secret are Pages secrets:
//   npx wrangler pages secret put CLOUDINARY_API_KEY --project-name kaibigan-loans
//   npx wrangler pages secret put CLOUDINARY_API_SECRET --project-name kaibigan-loans
import { handleUploadSignature, type UploadSignatureEnv } from "../../src/server/uploadSignature";

export const onRequestPost = ({ request, env }: { request: Request; env: UploadSignatureEnv }) =>
  handleUploadSignature(request, env);
