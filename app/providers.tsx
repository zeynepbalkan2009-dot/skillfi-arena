"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const PrivyRuntimeProviders = dynamic(
  () => import("@/components/PrivyRuntimeProviders").then((mod) => mod.PrivyRuntimeProviders),
  { ssr: false }
);

export function Providers({ children }: { children: ReactNode }) {
  return <PrivyRuntimeProviders>{children}</PrivyRuntimeProviders>;
}
