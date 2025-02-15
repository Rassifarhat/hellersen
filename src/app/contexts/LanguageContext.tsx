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
  detectedLanguage: Language;
  setDetectedLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [detectedLanguage, setDetectedLanguage] = useState<Language>(Language.UNKNOWN);

  return (
    <LanguageContext.Provider value={{ detectedLanguage, setDetectedLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
