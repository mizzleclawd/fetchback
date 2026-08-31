// Attachment intake: AgentMail attachment URL → bytes → Convex file storage.
// Kill-gate piece #2 of the inbound pipeline (inbound photo → storage →
// vision candidate). Failure-tolerant: a bad attachment must never kill
// match scoring — we return what we got and let the caller surface it.

import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per attachment
const MAX_PHOTOS = 3; // store at most this many per reply; first is the candidate

export type StoredPhoto = {
  storageId: Id<"_storage">;
  url: string;
  filename: string;
};

type MaybeAttachment = {
  filename?: string;
  content_type?: string;
  contentType?: string;
  url?: string;
  size?: number;
};

/** AgentMail inbound payloads carry attachments in several shapes; be liberal. */
function toAttachmentList(attachments: unknown): MaybeAttachment[] {
  if (!Array.isArray(attachments)) return [];
  return attachments.filter(
    (a): a is MaybeAttachment => !!a && typeof a === "object",
  );
}

function looksLikeImage(a: MaybeAttachment): boolean {
  const type = (a.content_type ?? a.contentType ?? "").toLowerCase();
  if (type.startsWith("image/")) return true;
  const ext = (a.filename ?? "").toLowerCase().split(".").pop() ?? "";
  return ["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext);
}

/**
 * Download image attachments referenced by an AgentMail message and store
 * them in Convex file storage. Returns the stored photos (first = primary
 * vision candidate) and a human-readable error if nothing could be stored.
 */
export async function storePhotoAttachments(
  ctx: ActionCtx,
  attachments: unknown,
): Promise<{ photos: StoredPhoto[]; error: string | null }> {
  const all = toAttachmentList(attachments);
  const images = all.filter((a) => looksLikeImage(a) && !!a.url);
  const photos: StoredPhoto[] = [];

  if (all.length > 0 && images.length === 0) {
    return {
      photos,
      error: `${all.length} attachment(s) present but none were recognizable images with URLs`,
    };
  }

  for (const a of images.slice(0, MAX_PHOTOS)) {
    try {
      const res = await fetch(a.url as string, { redirect: "follow" });
      if (!res.ok) {
        if (photos.length === 0) {
          return { photos, error: `Attachment fetch failed: HTTP ${res.status}` };
        }
        break;
      }
      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > MAX_BYTES) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) continue;
      const contentType =
        (a.content_type ?? a.contentType ?? res.headers.get("content-type")) ??
        "application/octet-stream";
      const storageId = await ctx.storage.store(
        new Blob([buf], { type: contentType }),
      );
      const url = await ctx.storage.getUrl(storageId);
      if (!url) continue;
      photos.push({
        storageId,
        url,
        filename: a.filename ?? "attachment",
      });
    } catch {
      // Try the next attachment; report only if nothing stored at all.
    }
  }

  if (photos.length === 0 && images.length > 0) {
    return { photos, error: "No image attachment could be downloaded/stored" };
  }
  return { photos, error: null };
}
