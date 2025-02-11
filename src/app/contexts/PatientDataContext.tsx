"use client";
import React, { createContext, useContext, useState } from "react";

interface PatientData {
  content: string;
}

interface PatientDataContextType {
  patientData: PatientData | null;
  setPatientData: (data: PatientData) => void;
  clearPatientData: () => void;
}

const PatientDataContext = createContext<PatientDataContextType | undefined>(undefined);

export const PatientDataProvider = ({ children }: { children: React.ReactNode }) => {
  const [patientData, setPatientDataState] = useState<PatientData | null>(null);

  const setPatientData = (data: PatientData) => {
    setPatientDataState(data);
  };

  const clearPatientData = () => {
    setPatientDataState(null);
  };

  return (
    <PatientDataContext.Provider value={{ patientData, setPatientData, clearPatientData }}>
      {children}
    </PatientDataContext.Provider>
  );
};

export const usePatientData = () => {
  const context = useContext(PatientDataContext);
  if (!context) {
    throw new Error("usePatientData must be used within a PatientDataProvider");
  }
  return context;
};