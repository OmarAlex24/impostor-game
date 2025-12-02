"use client"

import { useState, useRef, useEffect } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Ghost, Send } from "lucide-react"

interface SpectatorChatProps {
  roomId: Id<"rooms">
  sessionId: string
  isSpectator: boolean
}

export function SpectatorChat({ roomId, sessionId, isSpectator }: SpectatorChatProps) {
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const messages = useQuery(api.messages.getSpectatorMessages, { roomId })
  const sendMessage = useMutation(api.messages.sendMessage)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    if (!message.trim() || !isSpectator || isSending) return

    setIsSending(true)
    try {
      await sendMessage({
        roomId,
        sessionId,
        content: message.trim(),
      })
      setMessage("")
    } catch (err) {
      console.error(err)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isSpectator) {
    return null
  }

  return (
    <Card className="bg-card/50 border-border h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Ghost className="w-4 h-4" />
          Chat de Espectadores
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        {/* Messages list */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-0">
          {messages?.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No hay mensajes aún. ¡Sé el primero en escribir!
            </p>
          )}
          {messages?.map((msg) => (
            <div
              key={msg._id}
              className={`text-sm ${
                msg.senderSessionId === sessionId
                  ? "text-right"
                  : "text-left"
              }`}
            >
              <div
                className={`inline-block px-3 py-1.5 rounded-lg max-w-[85%] ${
                  msg.senderSessionId === sessionId
                    ? "bg-primary/20 text-primary-foreground"
                    : "bg-secondary"
                }`}
              >
                <span className="font-medium text-xs opacity-70">
                  {msg.senderName}
                </span>
                <p className="break-words">{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 flex-shrink-0">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            className="text-sm"
            maxLength={500}
            disabled={isSending}
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            size="sm"
            className="px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
