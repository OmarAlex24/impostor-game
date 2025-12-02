"use client"

import { useEffect, useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WordReveal } from "@/components/word-reveal"
import { CountdownTimer } from "@/components/countdown-timer"
import { PlayerList } from "@/components/player-list"
import { MessageCircle, Vote } from "lucide-react"

interface GameBoardProps {
  room: Doc<"rooms">
  players: Doc<"players">[]
  currentPlayer: Doc<"players">
  sessionId: string
}

export function GameBoard({ room, players, currentPlayer, sessionId }: GameBoardProps) {
  const [showWord, setShowWord] = useState(false)
  const startVoting = useMutation(api.rooms.startVoting)

  const isImpostor = room.impostorId === sessionId
  const isHost = currentPlayer.isHost
  const word = isImpostor ? null : room.currentWord

  // Mostrar la palabra automáticamente al inicio
  useEffect(() => {
    const timer = setTimeout(() => setShowWord(true), 500)
    return () => clearTimeout(timer)
  }, [])

  const handleStartVoting = async () => {
    try {
      await startVoting({ roomId: room._id, sessionId })
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <main className="min-h-screen flex flex-col p-4">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Header con timer */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-primary" />
              Fase de discusión
            </h1>
            <p className="text-muted-foreground text-sm">Categoría: {room.category}</p>
          </div>
          {room.discussionEndTime && <CountdownTimer endTime={room.discussionEndTime} onComplete={() => {}} />}
        </div>

        {/* Palabra revelada */}
        {showWord && <WordReveal word={word} isImpostor={isImpostor} />}

        {/* Instrucciones */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            {isImpostor ? (
              <div className="text-center space-y-2">
                <p className="text-destructive font-medium">Eres el impostor</p>
                <p className="text-sm text-muted-foreground">
                  No conoces la palabra. Intenta descubrirla sin que te descubran. Da pistas vagas y observa las
                  reacciones de los demás.
                </p>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <p className="text-primary font-medium">Conoces la palabra secreta</p>
                <p className="text-sm text-muted-foreground">
                  Da pistas sobre la palabra sin decirla directamente. Encuentra al impostor observando quién no parece
                  conocerla.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de jugadores */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Jugadores</CardTitle>
          </CardHeader>
          <CardContent>
            <PlayerList players={players} currentSessionId={sessionId} />
          </CardContent>
        </Card>

        {/* Botón para iniciar votación (solo host) */}
        {isHost && (
          <Button
            onClick={handleStartVoting}
            className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            size="lg"
          >
            <Vote className="h-5 w-5 mr-2" />
            Iniciar Votación
          </Button>
        )}

        {!isHost && (
          <p className="text-center text-sm text-muted-foreground">Esperando que el host inicie la votación...</p>
        )}
      </div>
    </main>
  )
}
