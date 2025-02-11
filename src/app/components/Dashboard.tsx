"use client";

import React from "react";
import dynamic from "next/dynamic";

// Dynamically import SurgicalScribe (default export)
const SurgicalScribe = dynamic(
  () => import('@/app/components/surgicalScribe').then((mod) => mod.default),
  { ssr: false }
);

export default function Dashboard() {
  // Always render SurgicalScribe for debugging purposes.
  return (
    <div className="h-full w-full">
      <SurgicalScribe />
    </div>
  );
}