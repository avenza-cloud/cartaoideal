"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

const PUB_ID = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID;

interface AdSlotProps {
  slot: string;
  format?: "auto" | "rectangle" | "vertical" | "horizontal";
  className?: string;
}

export function AdSlot({ slot, format = "auto", className }: AdSlotProps) {
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!PUB_ID || !insRef.current) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      // adsbygoogle not yet loaded — Script lazyOnload will trigger it
    }
  }, []);

  if (!PUB_ID) return null;

  return (
    <div className={className}>
      <Script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUB_ID}`}
        strategy="lazyOnload"
        crossOrigin="anonymous"
      />
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={PUB_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
