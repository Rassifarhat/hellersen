"use client";

import React from "react";
import { usePatientData } from "@/app/contexts/PatientDataContext";
import Events from "@/app/components/Events";
import dynamic from "next/dynamic";

// Dynamically import SurgicalScribe (default export)
const SurgicalScribe = dynamic(
  () => import('@/app/components/surgicalScribe').then((mod) => mod.default),
  { ssr: false }
);

export interface DashboardProps {
  isEventsPaneExpanded: boolean;
}

export default function Dashboard({ isEventsPaneExpanded }: DashboardProps) {
  const { patientData } = usePatientData();

  return (
    <div className="w-1/2 h-full overflow-auto rounded-xl transition-all duration-200 ease-in-out flex flex-col bg-customGray">
      {patientData ? (
        <SurgicalScribe />
      ) : (
        <Events isExpanded={isEventsPaneExpanded} />
      )}
    </div>
  );
}