"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders the Clabane logo (public/assets/clabane-logo.png) with the
 * "We Love African Skin" tagline beside it. Falls back to a text wordmark
 * if the image fails to load (e.g. the asset hasn't been uploaded yet) so
 * the header never shows a broken image icon.
 *
 * This must stay a Client Component: the onError fallback is a browser
 * event handler, which can only be attached from client-rendered code — a
 * Server Component has no live JS to attach it with. The mount-time check
 * below (in addition to onError) matters too, because the image request
 * can fail before React hydrates and attaches that listener — a load that
 * already failed by then never re-fires the error event, so onError alone
 * would miss it.
 */
export function ClabaneLogo({
  height = 36,
  mobileHeight = 28,
  showTagline = true,
}: {
  height?: number;
  mobileHeight?: number;
  showTagline?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setImgFailed(true);
    }
  }, []);

  const sizeStyle = {
    "--clabane-logo-height": `${height}px`,
    "--clabane-logo-mobile-height": `${mobileHeight}px`,
  } as React.CSSProperties;

  return (
    <span className="flex items-center gap-3">
      {imgFailed ? (
        <span className="text-lg font-bold text-white">
          Clabane <span className="text-water-leaf">Academy</span>
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- fixed local asset, onError fallback needs a plain img
        <img
          ref={imgRef}
          src="/assets/clabane-logo.png"
          alt="Clabane"
          className="clabane-logo-img w-auto"
          style={sizeStyle}
          onError={() => setImgFailed(true)}
        />
      )}
      {showTagline && (
        <span className="hidden text-xs italic text-water-leaf min-[480px]:inline">
          We Love African Skin
        </span>
      )}
    </span>
  );
}
