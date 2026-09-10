"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders the Clabane logo image (public/assets/clabane-logo.png). Falls
 * back to a text wordmark if the image fails to load (e.g. the asset
 * hasn't been uploaded yet) so the header never shows a broken image icon.
 *
 * The mount-time check (in addition to onError) matters because the image
 * request can fail before React hydrates and attaches the error listener —
 * a load that already failed by then never re-fires the error event, so
 * onError alone misses it.
 */
export function ClabaneLogo({ imgClassName = "h-8 sm:h-10 w-auto" }: { imgClassName?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setImgFailed(true);
    }
  }, []);

  if (imgFailed) {
    return (
      <span className="text-lg font-bold text-white">
        Clabane <span className="text-[var(--clabane-water-leaf)]">Academy</span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed local asset, onError fallback needs a plain img
    <img
      ref={imgRef}
      src="/assets/clabane-logo.png"
      alt="Clabane"
      className={imgClassName}
      onError={() => setImgFailed(true)}
    />
  );
}
