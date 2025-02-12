"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { usePatientData } from "@/app/contexts/PatientDataContext";
import { useEmail } from "@/app/contexts/EmailContext";
import Message from "@/app/components/message";

export default function SurgicalScribePage() {
  // Get patient data from context
  const { patientData } = usePatientData();
  const { sendEmail, setSendEmail } = useEmail();

  // Initialize the chat hook with our API endpoint and an explicit id.
  const { messages, append } = useChat({
    api: "/api/scribe",
    id: "surgical-scribe",
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  // Use a ref to track the last submitted patient data content.
  const lastSubmitted = useRef<string | null>(null);

  // Handle email sending when sendEmail flag is true
  useEffect(() => {
    if (sendEmail && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const emailContent = lastMessage.content;
      
      // Get first 10 words of the message for the subject
      const firstTenWords = emailContent.split(' ')
        .slice(0, 10)
        .join(' ')
        .trim() + '...';
      
      fetch('/api/sendEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: "rassiphfarhat@gmail.com",
          subject: firstTenWords,
          text: emailContent,
        }),
      })
      .then(response => response.json())
      .then((data) => {
        console.log(data.message || data.error);
        setSendEmail(false);
      })
      .catch(error => {
        console.error('Error sending email:', error);
        setSendEmail(false);
      });
    }
  }, [sendEmail, messages, setSendEmail]);

  // Whenever patientData.content changes and is different from lastSubmitted, trigger a new submission.
  useEffect(() => {
    if (patientData?.content && patientData.content !== lastSubmitted.current) {
      console.log("Appending new patient data via hidden submission:", patientData.content);
      append({ content: patientData.content, role: "user" });
      lastSubmitted.current = patientData.content;
    }
  }, [patientData?.content, append]);

  // Auto-scroll when messages update.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="relative h-full w-full bg-black">
      <div className="container h-full w-full flex flex-col py-8">
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
        </div>
      </div>
    </div>
  );
}