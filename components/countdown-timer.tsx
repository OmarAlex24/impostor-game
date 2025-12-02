"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface CountdownTimerProps {
  endTime: number
  onComplete: () => void
  showSeconds?: boolean
}

export function CountdownTimer({ endTime, onComplete, showSeconds = true }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0)

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now()
      const remaining = Math.max(0, endTime - now)
      return Math.floor(remaining / 1000)
    }

    setTimeLeft(calculateTimeLeft())

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft()
      setTimeLeft(remaining)

      if (remaining <= 0) {
        clearInterval(interval)
        onComplete()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [endTime, onComplete])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  const isLow = timeLeft <= 10
  const isCritical = timeLeft <= 5

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xl font-bold transition-colors",
        isCritical
          ? "bg-destructive/20 text-destructive animate-pulse"
          : isLow
            ? "bg-yellow-500/20 text-yellow-500"
            : "bg-secondary text-foreground",
      )}
    >
      <Clock className="w-5 h-5" />
      {showSeconds ? (
        <span>
          {minutes}:{seconds.toString().padStart(2, "0")}
        </span>
      ) : (
        <span>{minutes}m</span>
      )}
    </div>
  )
}
