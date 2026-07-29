"use client";

import { useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_SAMPLES = 6;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // Supabase's default per-file cap
const ACCEPTED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const ACCEPTED_EXTENSIONS = ["mp4", "webm", "mov"];

export type WorkSample = {
  id: string;
  title: string;
  storage_path: string;
};

/**
 * Upload / list / delete the signed-in pro's work sample clips. The
 * "work_samples" bucket is public-read, so plain public URLs work in <video>
 * tags; write access is enforced by storage policies + RLS
 * (see supabase/work-samples.sql), not here.
 */
export function WorkSamplesManager({
  userId,
  initial,
}: {
  userId: string;
  initial: WorkSample[];
}) {
  const [samples, setSamples] = useState(initial);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Remounts the file input after a successful upload to clear its selection.
  const [inputKey, setInputKey] = useState(0);

  const supabase = createClient();

  function publicUrl(path: string) {
    return supabase.storage.from("work_samples").getPublicUrl(path).data
      .publicUrl;
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Choose a video file to upload.");
      return;
    }
    if (!title.trim()) {
      setError("Give this clip a short title.");
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Only MP4, WebM, or QuickTime (.mov) videos are supported.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is over the 50MB limit. Try a shorter or more compressed clip.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError("Only MP4, WebM, or QuickTime (.mov) videos are supported.");
      return;
    }

    setBusy(true);
    // Never put the original filename in the key — names with spaces (e.g.
    // Apple's "Movie on … at ….mov") break Supabase storage key validation.
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("work_samples")
      .upload(path, file);

    if (uploadError) {
      console.error("[work-samples] upload failed:", uploadError);
      setError("Upload failed. Please try again.");
      setBusy(false);
      return;
    }

    const { data: row, error: insertError } = await supabase
      .from("work_samples")
      .insert({ profile_id: userId, title: title.trim(), storage_path: path })
      .select("id, title, storage_path")
      .single();

    if (insertError || !row) {
      console.error("[work-samples] insert failed:", insertError);
      // Don't leave an orphaned file behind.
      await supabase.storage.from("work_samples").remove([path]);
      setError("Saving the clip failed. Please try again.");
      setBusy(false);
      return;
    }

    setSamples((prev) => [row, ...prev]);
    setTitle("");
    setFile(null);
    setInputKey((k) => k + 1);
    setBusy(false);
  }

  async function handleDelete(sample: WorkSample) {
    setError(null);
    setDeletingId(sample.id);

    const { error: storageError } = await supabase.storage
      .from("work_samples")
      .remove([sample.storage_path]);
    const { error: rowError } = await supabase
      .from("work_samples")
      .delete()
      .eq("id", sample.id);

    if (storageError || rowError) {
      console.error("[work-samples] delete failed:", storageError ?? rowError);
      setError("Removing the clip failed. Please try again.");
      setDeletingId(null);
      return;
    }

    setSamples((prev) => prev.filter((s) => s.id !== sample.id));
    setDeletingId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {samples.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {samples.map((sample) => (
            <li key={sample.id} className="flex flex-col gap-2">
              <video
                controls
                preload="metadata"
                src={publicUrl(sample.storage_path)}
                className="aspect-video w-full rounded-lg border border-border bg-black"
              />
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {sample.title}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(sample)}
                  disabled={deletingId === sample.id}
                  aria-label={`Remove ${sample.title}`}
                >
                  {deletingId === sample.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {samples.length >= MAX_SAMPLES ? (
        <p className="text-sm text-muted-foreground">
          You&rsquo;ve reached the maximum of {MAX_SAMPLES} work samples —
          remove one to add another.
        </p>
      ) : (
        <form onSubmit={handleUpload} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="work-sample-title">Title</Label>
            <Input
              id="work-sample-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Short film scene — 'Night Shift'"
              disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="work-sample-file">Video file (max 50MB)</Label>
            <Input
              key={inputKey}
              id="work-sample-file"
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                setFile(picked);
                if (picked && !title.trim()) {
                  setTitle(picked.name.replace(/\.[^.]+$/, ""));
                }
              }}
              disabled={busy}
            />
          </div>

          <div>
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {busy ? "Uploading…" : "Upload clip"}
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
