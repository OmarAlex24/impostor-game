"use client"

import { useState, useEffect } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CountdownTimer } from "@/components/countdown-timer"
import { PlayerList } from "@/components/player-list"
import { SpectatorChat } from "@/components/spectator-chat"
import { Vote, Check, Crown, Loader2, Ghost } from "lucide-react"

interface VotingPhaseProps {
  room: Doc<"rooms">
  players: Doc<"players">[]
  currentPlayer: Doc<"players">
  sessionId: string
}

export function VotingPhase({ room, players, currentPlayer, sessionId }: VotingPhaseProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(currentPlayer.votedFor || null)
  const [hasVoted, setHasVoted] = useState(!!currentPlayer.votedFor)
  const [isProcessing, setIsProcessing] = useState(false)

  const vote = useMutation(api.players.vote)
  const processVotingResults = useMutation(api.rooms.processVotingResults)

  const isHost = currentPlayer.isHost
  const isEliminated = currentPlayer.isEliminated
  const activePlayers = players.filter((p) => !p.isEliminated)
  const spectators = players.filter((p) => p.isEliminated)
  const allVoted = activePlayers.every((p) => p.votedFor)

  // Actualizar estado si ya votó
  useEffect(() => {
    if (currentPlayer.votedFor) {
      setSelectedPlayer(currentPlayer.votedFor)
      setHasVoted(true)
    }
  }, [currentPlayer.votedFor])

  const handleVote = async () => {
    if (!selectedPlayer || hasVoted) return

    try {
      await vote({
        voterId: currentPlayer._id,
        targetSessionId: selectedPlayer,
      })
      setHasVoted(true)
    } catch (err) {
      console.error(err)
    }
  }

  const handleProcessResults = async () => {
    setIsProcessing(true)
    try {
      await processVotingResults({ roomId: room._id, sessionId })
    } catch (err) {
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  // Filtrar jugadores votables (no puedes votarte a ti mismo, solo activos)
  const votablePlayers = activePlayers.filter((p) => p.sessionId !== sessionId)

  // Spectator view
  if (isEliminated) {
    return (
      <main className="min-h-screen flex flex-col p-4">
        <div className="w-full max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main voting view (spectator) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Spectator banner */}
              <Card className="bg-muted/50 border-dashed border-2">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <Ghost className="w-8 h-8 text-muted-foreground" />
                    <div>
                      <p className="font-bold">Eres espectador</p>
                      <p className="text-sm text-muted-foreground">
                        Observa la votación y chatea con otros espectadores.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Vote className="w-6 h-6 text-destructive" />
                    Votación
                  </h1>
                  <p className="text-muted-foreground text-sm">Los jugadores están votando...</p>
                </div>
                {room.votingEndTime && <CountdownTimer endTime={room.votingEndTime} onComplete={() => {}} />}
              </div>

              {/* Voting progress */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    Votos: {activePlayers.filter((p) => p.votedFor).length} / {activePlayers.length}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PlayerList players={activePlayers} currentSessionId={sessionId} showVotes showHasVoted />
                </CardContent>
              </Card>
            </div>

            {/* Spectator chat */}
            <div className="h-[400px] lg:h-auto">
              <SpectatorChat roomId={room._id} sessionId={sessionId} isSpectator={isEliminated} />
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Active player view
  return (
    <main className="min-h-screen flex flex-col p-4">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Vote className="w-6 h-6 text-destructive" />
              Votación
            </h1>
            <p className="text-muted-foreground text-sm">¿Quién crees que es el impostor?</p>
          </div>
          {room.votingEndTime && <CountdownTimer endTime={room.votingEndTime} onComplete={() => {}} />}
        </div>

        {/* Estado de voto */}
        {hasVoted ? (
          <Card className="bg-primary/10 border-primary">
            <CardContent className="pt-4 text-center">
              <Check className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-primary font-medium">¡Has votado!</p>
              <p className="text-sm text-muted-foreground">Esperando a los demás jugadores...</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Selecciona al impostor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {votablePlayers.map((player) => (
                  <div
                    key={player._id}
                    onClick={() => setSelectedPlayer(player.sessionId)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      selectedPlayer === player.sessionId
                        ? "bg-destructive/20 ring-2 ring-destructive"
                        : "bg-secondary hover:bg-secondary/80"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg font-medium">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium flex items-center gap-2">
                        {player.name}
                        {player.isHost && <Crown className="w-4 h-4 text-yellow-500" />}
                      </span>
                    </div>
                    {selectedPlayer === player.sessionId && (
                      <div className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center">
                        <Check className="w-4 h-4 text-destructive-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                onClick={handleVote}
                disabled={!selectedPlayer}
                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                size="lg"
              >
                <Vote className="h-5 w-5 mr-2" />
                Confirmar Voto
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Progreso de votos */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              Votos: {activePlayers.filter((p) => p.votedFor).length} / {activePlayers.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PlayerList players={activePlayers} currentSessionId={sessionId} showVotes showHasVoted />
            {spectators.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                  <Ghost className="w-4 h-4" />
                  Espectadores ({spectators.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {spectators.map((p) => (
                    <span key={p._id} className="px-2 py-1 rounded-full text-xs bg-muted opacity-60">
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botón para procesar resultados (solo host) */}
        {isHost && (
          <Button
            onClick={handleProcessResults}
            disabled={!allVoted || isProcessing}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Procesando...
              </>
            ) : allVoted ? (
              "Revelar Resultados"
            ) : (
              "Esperando todos los votos..."
            )}
          </Button>
        )}
      </div>
    </main>
  )
}
