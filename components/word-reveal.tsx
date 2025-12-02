"use client"

import { cn } from "@/lib/utils"
import { Eye, EyeOff } from "lucide-react"

interface WordRevealProps {
  word: string | null | undefined
  isImpostor: boolean
}

export function WordReveal({ word, isImpostor }: WordRevealProps) {
  return (
    <div
      className={cn(
        "relative p-8 rounded-2xl text-center transition-all",
        isImpostor
          ? "bg-destructive/10 border-2 border-destructive impostor-reveal"
          : "bg-primary/10 border-2 border-primary word-reveal",
      )}
    >
      <div className="absolute top-4 right-4">
        {isImpostor ? <EyeOff className="w-6 h-6 text-destructive" /> : <Eye className="w-6 h-6 text-primary" />}
      </div>

      <p className="text-sm uppercase tracking-widest text-muted-foreground mb-2">
        {isImpostor ? "Tu palabra es..." : "La palabra es..."}
      </p>

      <h2
        className={cn(
          "text-4xl md:text-5xl font-bold tracking-tight",
          isImpostor ? "text-destructive" : "text-primary",
        )}
      >
        {isImpostor ? "???" : word}
      </h2>

      <p className={cn("mt-4 text-sm", isImpostor ? "text-destructive/80" : "text-primary/80")}>
        {isImpostor ? "¡No dejes que te descubran!" : "¡No digas la palabra directamente!"}
      </p>
    </div>
  )
}
