"use client"

import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { SILENCIO_EMOJIS } from "@/convex/gameModes"
import { cn } from "@/lib/utils"

interface EmojiPanelProps {
  roomId: Id<"rooms">
  sessionId: string
  disabled?: boolean
}

export function EmojiPanel({ roomId, sessionId, disabled }: EmojiPanelProps) {
  const sendEmoji = useMutation(api.rooms.sendEmoji)
  const emojis = useQuery(api.rooms.getEmojis, { roomId })

  const handleSendEmoji = async (emoji: string) => {
    if (disabled) return
    try {
      await sendEmoji({ roomId, sessionId, emoji })
    } catch (err) {
      console.error(err)
    }
  }

  // Group recent emojis by sender
  const recentEmojis = emojis?.slice(0, 20) || []

  return (
    <div className="space-y-4">
      {/* Emoji Picker */}
      <div className="bg-secondary/50 rounded-lg p-3">
        <p className="text-xs text-muted-foreground mb-2 text-center">
          Modo Silencio - Solo puedes comunicarte con emojis
        </p>
        <div className="grid grid-cols-6 gap-2">
          {SILENCIO_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSendEmoji(emoji)}
              disabled={disabled}
              className={cn(
                "text-2xl p-2 rounded-lg transition-all",
                "hover:bg-primary/20 hover:scale-110",
                "active:scale-95",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Emojis Feed */}
      {recentEmojis.length > 0 && (
        <div className="bg-card rounded-lg p-3 border border-border">
          <p className="text-xs text-muted-foreground mb-2">Reacciones recientes</p>
          <div className="flex flex-wrap gap-2">
            {recentEmojis.map((msg) => (
              <div
                key={msg._id}
                className="flex items-center gap-1 bg-secondary/50 rounded-full px-2 py-1"
              >
                <span className="text-xs text-muted-foreground">{msg.senderName}:</span>
                <span className="text-lg">{msg.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
