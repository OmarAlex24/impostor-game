"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, Copy, Share2 } from "lucide-react"

interface ShareRoomProps {
  code: string
}

export function ShareRoom({ code }: ShareRoomProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${code}` : ""

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Error copying:", err)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Únete a mi partida de Impostor",
          text: `Únete con el código: ${code}`,
          url: shareUrl,
        })
      } catch (err) {
        // User cancelled
      }
    } else {
      handleCopy()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="px-4 py-2 bg-secondary rounded-lg font-mono text-lg tracking-widest">{code}</div>
      <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0 bg-transparent">
        {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
      </Button>
      {"share" in navigator && (
        <Button variant="outline" size="icon" onClick={handleShare} className="shrink-0 bg-transparent">
          <Share2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
