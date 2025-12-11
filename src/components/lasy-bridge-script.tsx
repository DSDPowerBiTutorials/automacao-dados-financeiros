"use client";

import Script from "next/script";

export default function LasyBridgeScript() {
  return <Script src="/lasy-bridge.js" strategy="beforeInteractive" />;
}
