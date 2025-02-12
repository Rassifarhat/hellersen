"use client";
import React, { createContext, useContext, useState } from 'react';


interface EmailContextType {
  sendEmail: boolean;
  setSendEmail: (value: boolean) => void;
}

const EmailContext = createContext<EmailContextType | undefined>(undefined);

export const EmailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sendEmail, setSendEmail] = useState(false);

  return (
    <EmailContext.Provider value={{ sendEmail, setSendEmail }}>
      {children}
    </EmailContext.Provider>
  );
};

export const useEmail = () => {
  const context = useContext(EmailContext);
  if (context === undefined) {
    throw new Error('useEmail must be used within an EmailProvider');
  }
  return context;
};
