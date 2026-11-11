"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Loader2, Plus, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  MAX_PORTFOLIO_FILES,
  newPortfolioPath,
  PORTFOLIO_ACCEPT,
  type PortfolioFile,
} from "@/lib/portfolio";
import { Button } from "@/components/ui/button";
import { addPortfolioFiles, removePortfolioFile } from "./actions";

/**
 * The Portfolio card's list, with Add files and a Remove per file (PX F19).
 * Files go straight from the browser to the private "portfolios" bucket, as at
 * onboarding; addPortfolioFiles then lists them on the profile, and any upload
 * it can't list is deleted again.
 */
export function PortfolioManager({
  userId,
  files,
}: {
  userId: string;
  files: PortfolioFile[];
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  const room = MAX_PORTFOLIO_FILES - files.length;

  function add(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = ""; // so picking the same file again still fires
    if (chosen.length === 0) return;
    setError(null);
    if (chosen.length > room) {
      setError(
        `A portfolio holds up to ${MAX_PORTFOLIO_FILES} files. You can add ${room} more.`
      );
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const uploaded: string[] = [];
      try {
        for (const file of chosen) {
          const path = newPortfolioPath(userId, file.name);
          const { error: uploadError } = await supabase.storage
            .from("portfolios")
            .upload(path, file);
          if (uploadError) throw uploadError;
          uploaded.push(path);
        }
        const result = await addPortfolioFiles(uploaded);
        if (result.error) {
          await supabase.storage.from("portfolios").remove(uploaded);
          setError(result.error);
          return;
        }
        router.refresh();
      } catch {
        if (uploaded.length > 0) {
          await supabase.storage.from("portfolios").remove(uploaded);
        }
        setError("Couldn't upload those files. Try again.");
      }
    });
  }

  function remove(path: string) {
    setError(null);
    setRemoving(path);
    startTransition(async () => {
      const result = await removePortfolioFile(path);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {files.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li key={file.path} className="flex items-center gap-2">
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:border-brand hover:bg-muted/50"
              >
                <FileText className="size-4 shrink-0 text-brand" />
                <span className="truncate">{file.name}</span>
                <ExternalLink className="ml-auto size-4 shrink-0 text-muted-foreground" />
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(file.path)}
                disabled={pending}
                aria-label={`Remove ${file.name}`}
              >
                {pending && removing === file.path ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <X className="size-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No portfolio files uploaded yet.
        </p>
      )}

      <input
        ref={input}
        type="file"
        multiple
        accept={PORTFOLIO_ACCEPT}
        onChange={add}
        className="hidden"
      />
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setRemoving(null);
            input.current?.click();
          }}
          disabled={pending || room <= 0}
        >
          {pending && removing === null ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Add files
        </Button>
        {room <= 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            That&rsquo;s the {MAX_PORTFOLIO_FILES}-file limit. Remove one to add
            another.
          </p>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
