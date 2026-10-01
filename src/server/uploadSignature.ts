import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Server-only. Shared by the Cloudflare Pages Function (functions/api/upload-signature.ts)
 * and the local dev route (src/app/api/upload-signature/route.dev.ts).
 */
export interface UploadSignatureEnv {
  FIREBASE_PROJECT_ID?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
}

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

async function sha1Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Returns a short-lived Cloudinary upload signature to signed-in, email-verified users only.
 * The Firebase ID token is verified with Google's public keys, and the Cloudinary API secret
 * never reaches the browser.
 */
export async function handleUploadSignature(request: Request, env: UploadSignatureEnv): Promise<Response> {
  const projectId = env.FIREBASE_PROJECT_ID;
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  if (!projectId || !cloudName || !apiKey || !apiSecret) {
    return Response.json({ error: "Server is not configured" }, { status: 500 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Missing token" }, { status: 401 });

  let uid: string;
  try {
    const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (!payload.sub || payload.email_verified !== true) throw new Error("Unverified user");
    uid = payload.sub;
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  // Borrower payment receipts vs. the lender's proof of send.
  const body = (await request.json().catch(() => ({}))) as { kind?: string };
  const kind = body.kind === "disbursements" ? "disbursements" : "receipts";

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `kaibigan-loans/${kind}/${uid}`;
  // Cloudinary signature: sorted params joined with & + api secret, SHA-1.
  const signature = await sha1Hex(`folder=${folder}&timestamp=${timestamp}${apiSecret}`);

  return Response.json({ signature, timestamp, apiKey, cloudName, folder });
}
