import { Card, CardHeader } from "./ui/card";
import { Bot, User } from "lucide-react";
import { Message as MessageType } from "ai";

export default function Message({ message }: { message: MessageType }) {
  const { role, content } = message;
  if (role === "assistant") {
    return (
      <div className="flex flex-col gap-3 p-6 whitespace-pre-wrap text-white">
        <div className="flex items-center gap-2">
          <Bot />
          Clinic Assistant:
        </div>
        {content}
      </div>
    );
  }
  return (
    <Card className="whitespace-pre-wrap text-white">
      <CardHeader>
        <div className="flex items-center gap-2">
          <User size={36} />
          {content}
        </div>
      </CardHeader>
    </Card>
  );
}
