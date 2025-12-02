"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { wordCategories } from "@/convex/words"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlayerList } from "@/components/player-list"
import { ShareRoom } from "@/components/share-room"
import { Check, Crown, Loader2, Play, Clock } from "lucide-react"

interface LobbyProps {
  room: Doc<"rooms">
  players: Doc<"players">[]
  currentPlayer: Doc<"players">
  sessionId: string
}

export function Lobby({ room, players, currentPlayer, sessionId }: LobbyProps) {
  const [category, setCategory] = useState<string>("Animales")
  const [discussionMinutes, setDiscussionMinutes] = useState<number>(2)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState("")

  const toggleReady = useMutation(api.players.toggleReady)
  const startGame = useMutation(api.rooms.startGame)

  const isHost = currentPlayer.isHost
  const allReady = players.every((p) => p.isReady || p.isHost)
  const canStart = players.length >= 3 && allReady

  const handleToggleReady = async () => {
    try {
      await toggleReady({ playerId: currentPlayer._id })
    } catch (err) {
      console.error(err)
    }
  }

  const handleStartGame = async () => {
    if (!canStart) return
    setIsStarting(true)
    setError("")

    try {
      await startGame({
        roomId: room._id,
        sessionId,
        category,
        discussionMinutes,
      })
    } catch (err: any) {
      setError(err.message || "Error al iniciar")
      setIsStarting(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col p-4">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sala de espera</h1>
            <p className="text-muted-foreground text-sm">Esperando jugadores...</p>
          </div>
          <ShareRoom code={room.code} />
        </div>

        {/* Jugadores */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Jugadores ({players.length})</span>
              {players.length < 3 && (
                <span className="text-sm font-normal text-muted-foreground">Mínimo 3 jugadores</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PlayerList players={players} currentSessionId={sessionId} showReady />
          </CardContent>
        </Card>

        {/* Configuración del host */}
        {isHost && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-500" />
                Configuración
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="bg-secondary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(wordCategories).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Discusión
                  </Label>
                  <Select
                    value={discussionMinutes.toString()}
                    onValueChange={(v) => setDiscussionMinutes(Number.parseInt(v))}
                  >
                    <SelectTrigger className="bg-secondary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 minuto</SelectItem>
                      <SelectItem value="2">2 minutos</SelectItem>
                      <SelectItem value="3">3 minutos</SelectItem>
                      <SelectItem value="5">5 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <Button
                onClick={handleStartGame}
                disabled={!canStart || isStarting}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                size="lg"
              >
                {isStarting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Iniciar Juego
                  </>
                )}
              </Button>

              {!canStart && players.length >= 3 && (
                <p className="text-sm text-muted-foreground text-center">Esperando que todos estén listos...</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Botón listo para no-hosts */}
        {!isHost && (
          <Button
            onClick={handleToggleReady}
            variant={currentPlayer.isReady ? "outline" : "default"}
            className={
              currentPlayer.isReady ? "w-full border-primary text-primary" : "w-full bg-primary text-primary-foreground"
            }
            size="lg"
          >
            {currentPlayer.isReady ? (
              <>
                <Check className="h-5 w-5 mr-2" />
                ¡Listo!
              </>
            ) : (
              "Marcar como listo"
            )}
          </Button>
        )}
      </div>
    </main>
  )
}
