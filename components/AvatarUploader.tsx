"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { setAvatarPath } from "@/app/profile/actions";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 2 * 1024 * 1024; // matches the bucket limit (avatars.sql)
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Add, change or remove your profile photo (UX B-01). Used on the pro and fan
 * Profile pages. The file goes straight from the browser to the "avatars"
 * bucket under a new random name, then setAvatarPath saves it and deletes the
 * old one.
 */
export function AvatarUploader({
  userId,
  name,
  photoPath,
}: {
  userId: string;
  name: string | null;
  photoPath: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires
    if (!file) return;
    setError(null);

    const ext = EXTENSIONS[file.type];
    if (!ext) {
      setError("Choose a JPG, PNG or WebP photo.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That photo is over 2 MB. Choose a smaller one.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      try {
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, file, { contentType: file.type });
        if (uploadError) {
          setError("Couldn't upload that photo. Try again.");
          return;
        }
        const result = await setAvatarPath(path);
        if (result.error) {
          await supabase.storage.from("avatars").remove([path]);
          setError(result.error);
          return;
        }
        router.refresh();
      } catch {
        setError("Couldn't upload that photo. Try again.");
      }
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await setAvatarPath(null);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.refresh();
      } catch {
        setError("Couldn't remove your photo. Try again.");
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar
        name={name}
        photoPath={photoPath}
        className="size-20 text-2xl"
      />
      <div className="flex flex-col items-start gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Camera className="size-3.5" />
            )}
            {photoPath ? "Change photo" : "Add a photo"}
          </Button>
          {photoPath && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={remove}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG or WebP, up to 2 MB.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={choose}
        />
      </div>
    </div>
  );
}
