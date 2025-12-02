"use client"

import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlayerList } from "@/components/player-list"
import { Trophy, Skull, RotateCcw, Home } from "lucide-react"
import Link from "next/link"

interface GameResultsProps {
  room: Doc<"rooms">
  players: Doc<"players">[]
  currentPlayer: Doc<"players">
  sessionId: string
}

export function GameResults({ room, players, currentPlayer, sessionId }: GameResultsProps) {
  const resetRoom = useMutation(api.rooms.resetRoom)
  const isHost = currentPlayer.isHost

  // Calcular resultados
  const impostor = players.find((p) => p.sessionId === room.impostorId)
  const votes: Record<string, number> = {}

  players.forEach((p) => {
    if (p.votedFor) {
      votes[p.votedFor] = (votes[p.votedFor] || 0) + 1
    }
  })

  // Encontrar el más votado
  let maxVotes = 0
  let mostVoted: string | null = null
  Object.entries(votes).forEach(([sessionId, count]) => {
    if (count > maxVotes) {
      maxVotes = count
      mostVoted = sessionId
    }
  })

  const impostorCaught = mostVoted === room.impostorId
  const isCurrentPlayerImpostor = sessionId === room.impostorId

  const handlePlayAgain = async () => {
    try {
      await resetRoom({ roomId: room._id, sessionId })
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <main className="min-h-screen flex flex-col p-4">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Resultado principal */}
        <Card
          className={`border-2 ${
            impostorCaught ? "bg-primary/10 border-primary" : "bg-destructive/10 border-destructive"
          }`}
        >
          <CardContent className="pt-8 pb-8 text-center">
            {impostorCaught ? (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-primary mb-2">¡Impostor atrapado!</h1>
                <p className="text-muted-foreground">
                  {isCurrentPlayerImpostor
                    ? "Te han descubierto... ¡Mejor suerte la próxima!"
                    : "Han descubierto al impostor. ¡Buen trabajo equipo!"}
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
                  <Skull className="w-8 h-8 text-destructive" />
                </div>
                <h1 className="text-3xl font-bold text-destructive mb-2">¡El impostor gana!</h1>
                <p className="text-muted-foreground">
                  {isCurrentPlayerImpostor
                    ? "¡Nadie te descubrió! Eres un maestro del engaño."
                    : "El impostor ha escapado sin ser detectado."}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Revelación del impostor */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">El impostor era...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-4 rounded-lg bg-destructive/10 border border-destructive">
              <div className="w-14 h-14 rounded-full bg-destructive flex items-center justify-center text-2xl font-bold text-destructive-foreground">
                {impostor?.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xl font-bold">{impostor?.name}</p>
                <p className="text-sm text-muted-foreground">Recibió {votes[room.impostorId!] || 0} voto(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Palabra secreta */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">La palabra era...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-primary/10 border border-primary text-center">
              <p className="text-3xl font-bold text-primary">{room.currentWord}</p>
              <p className="text-sm text-muted-foreground mt-1">Categoría: {room.category}</p>
            </div>
          </CardContent>
        </Card>

        {/* Votos de todos */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Resultados de votación</CardTitle>
          </CardHeader>
          <CardContent>
            <PlayerList
              players={players}
              currentSessionId={sessionId}
              showVotes
              impostorId={room.impostorId}
              showImpostor
            />
          </CardContent>
        </Card>

        {/* Acciones */}
        <div className="flex gap-4">
          <Link href="/" className="flex-1">
            <Button variant="outline" className="w-full bg-transparent" size="lg">
              <Home className="h-5 w-5 mr-2" />
              Salir
            </Button>
          </Link>

          {isHost && (
            <Button
              onClick={handlePlayAgain}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              size="lg"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              Jugar de nuevo
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
