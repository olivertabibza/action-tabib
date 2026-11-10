"use client";

import { useEffect } from "react";

import { stampArticleMeter } from "./actions";

/**
 * Records a logged-out visitor's free article once the page is really open.
 * Prefetches never mount components, so they can't use up the free read.
 */
export function MeterStamp({ articleId }: { articleId: string }) {
  useEffect(() => {
    stampArticleMeter(articleId).catch(() => {
      // Best effort: if this fails, the visitor simply gets this article free.
    });
  }, [articleId]);
  return null;
}
