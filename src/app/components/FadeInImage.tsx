"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

// Wraps next/image with an opacity fade tied to the real `onLoad` event,
// rather than a fixed-duration CSS animation that fires on mount regardless
// of whether pixels have actually painted. Without this, a grid of images
// finishing decode at roughly the same time pops in all at once and reads
// as a flash, especially for light/white source photos.
export function FadeInImage({ className, onLoad, ...rest }: ImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Image
      {...rest}
      className={`transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
    />
  );
}
