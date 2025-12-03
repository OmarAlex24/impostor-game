"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { wordCategories } from "@/convex/words"
import { GAME_MODES, type GameModeId } from "@/convex/gameModes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlayerList } from "@/components/player-list"
import { ShareRoom } from "@/components/share-room"
import { GameModeSelector } from "@/components/game-mode-selector"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Check, Crown, Loader2, Play, Clock } from "lucide-react"

interface LobbyProps {
  room: Doc<"rooms">
  players: Doc<"players">[]
  currentPlayer: Doc<"players">
  sessionId: string
}

export function Lobby({ room, players, currentPlayer, sessionId }: LobbyProps) {
  const [gameMode, setGameMode] = useState<GameModeId>("clasico")
  const [category, setCategory] = useState<string>("Animales")
  const [discussionMinutes, setDiscussionMinutes] = useState<number>(2)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState("")
  // Kick dialog state
  const [kickTarget, setKickTarget] = useState<{ id: Id<"players">; name: string } | null>(null)
  const [isKicking, setIsKicking] = useState(false)

  const toggleReady = useMutation(api.players.toggleReady)
  const startGame = useMutation(api.rooms.startGame)
  const kickPlayer = useMutation(api.players.kick)

  const isHost = currentPlayer.isHost
  const allReady = players.every((p) => p.isReady || p.isHost)
  const modeConfig = GAME_MODES[gameMode]
  const canStart = players.length >= modeConfig.minPlayers && allReady

  const handleKickRequest = (playerId: Id<"players">, playerName: string) => {
    setKickTarget({ id: playerId, name: playerName })
  }

  const handleKickConfirm = async () => {
    if (!kickTarget) return
    setIsKicking(true)
    try {
      await kickPlayer({ playerId: kickTarget.id, kickerSessionId: sessionId })
    } catch (err: any) {
      console.error(err)
    } finally {
      setIsKicking(false)
      setKickTarget(null)
    }
  }

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
        gameMode,
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
              {players.length < modeConfig.minPlayers && (
                <span className="text-sm font-normal text-muted-foreground">
                  Min {modeConfig.minPlayers} para {modeConfig.name}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PlayerList
              players={players}
              currentSessionId={sessionId}
              showReady
              canKick={isHost}
              onKick={handleKickRequest}
            />
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
              {/* Game Mode Selector */}
              <div className="space-y-2">
                <Label>Modo de Juego</Label>
                <GameModeSelector
                  selectedMode={gameMode}
                  onSelectMode={setGameMode}
                  playerCount={players.length}
                />
              </div>

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

      {/* Kick confirmation dialog */}
      <AlertDialog open={!!kickTarget} onOpenChange={(open) => !open && setKickTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Expulsar a {kickTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará al jugador de la sala. Tendrá que unirse de nuevo con el código de la sala.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isKicking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleKickConfirm}
              disabled={isKicking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isKicking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Expulsar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
