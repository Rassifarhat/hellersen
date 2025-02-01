import { Card, CardHeader } from "./ui/card";
import { Bot, User } from "lucide-react";
import { Message as MessageType } from "ai";

export default function Message({ message }: { message: MessageType }) {
  const { role, content } = message;
  if (role === "assistant") {
    return (
      <div className="flex flex-col gap-3 p-6 whitespace-pre-wrap">
        <div className="flex items-center gap-2">
          <Bot />
          Clinic Assistant:
        </div>
        {content}
      </div>
    );
  }
  return (
    <Card className="whitespace-pre-wrap">
      <CardHeader>
        <div className="flex items-center gap-2 text-white">
          <User size={36} />
          {content}
        </div>
      </CardHeader>
    </Card>
  );
}
