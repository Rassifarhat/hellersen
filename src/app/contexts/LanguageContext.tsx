"use client";

import React, { createContext, useContext, useState } from 'react';

export enum Language {
  ENGLISH = 'english',
  ARABIC = 'arabic',
  HINDI = 'hindi',
  TAGALOG = 'tagalog',
  URDU = 'urdu',
  GERMAN = 'german',
  UNKNOWN = 'unknown'
}

interface LanguageContextType {
  doctorLanguage: Language;
  patientLanguage: Language;
  setDoctorLanguage: (lang: Language) => void;
  setPatientLanguage: (lang: Language) => void;
  setLanguageContext: (doctor: Language, patient: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [doctorLanguage, setDoctorLanguage] = useState<Language>(Language.UNKNOWN);
  const [patientLanguage, setPatientLanguage] = useState<Language>(Language.UNKNOWN);

  const setLanguageContext = (doctor: Language, patient: Language) => {
    setDoctorLanguage(doctor);
    setPatientLanguage(patient);
  };

  return (
    <LanguageContext.Provider value={{ 
      doctorLanguage, 
      patientLanguage, 
      setDoctorLanguage, 
      setPatientLanguage,
      setLanguageContext 
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
