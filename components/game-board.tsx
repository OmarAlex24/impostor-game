"use client"

import { useEffect, useState, useRef } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WordReveal } from "@/components/word-reveal"
import { PlayerList } from "@/components/player-list"
import { SpectatorChat } from "@/components/spectator-chat"
import { EmojiPanel } from "@/components/emoji-panel"
import { RoleActions, GhostClueDisplay } from "@/components/role-actions"
import { TeamDisplay } from "@/components/team-display"
import { CombatView } from "@/components/combat-view"
import { GAME_MODES, type GameModeId } from "@/convex/gameModes"
import { playTurnSound } from "@/lib/sounds"
import { MessageCircle, Vote, ArrowRight, Loader2, Ghost, Clock, Users, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface GameBoardProps {
  room: Doc<"rooms">
  players: Doc<"players">[]
  currentPlayer: Doc<"players">
  sessionId: string
}

export function GameBoard({ room, players, currentPlayer, sessionId }: GameBoardProps) {
  const [showWord, setShowWord] = useState(false)
  const [isPassingTurn, setIsPassingTurn] = useState(false)
  const [isCallingVote, setIsCallingVote] = useState(false)
  const [turnTimeLeft, setTurnTimeLeft] = useState<number | null>(null)
  const prevTurnIndexRef = useRef<number | undefined>(undefined)

  const startVoting = useMutation(api.rooms.startVoting)
  const passTurn = useMutation(api.rooms.passTurn)
  const autoPassTurn = useMutation(api.rooms.autoPassTurn)
  const callToVote = useMutation(api.rooms.callToVote)

  const gameMode = (room.gameMode || "clasico") as GameModeId
  const modeConfig = GAME_MODES[gameMode]
  const isImpostor = room.impostorId === sessionId || room.impostorId2 === sessionId
  const isHost = currentPlayer.isHost
  const isEliminated = currentPlayer.isEliminated
  const word = isImpostor ? null : room.currentWord
  const isSilencioMode = gameMode === "silencio"
  const isRolesSecretosMode = gameMode === "roles_secretos"
  const isTeamMode = gameMode === "team_vs_team"
  const isCombateMode = gameMode === "combate"
  const isDobleAgenteMode = gameMode === "doble_agente"

  // Filter active players (non-eliminated)
  const activePlayers = players.filter((p) => !p.isEliminated)
  const spectators = players.filter((p) => p.isEliminated)

  // Turn system
  const currentTurnSessionId = room.turnOrder && room.currentTurnIndex !== undefined
    ? room.turnOrder[room.currentTurnIndex]
    : null
  const isMyTurn = currentTurnSessionId === sessionId && !isEliminated
  const currentTurnPlayer = activePlayers.find((p) => p.sessionId === currentTurnSessionId)

  // Round info
  const roundNumber = room.roundNumber || 1
  const totalRounds = room.totalRoundsPerVoting || 2

  // Call to vote info
  const callToVoteCount = room.callToVoteBy?.length || 0
  const hasCalledVote = room.callToVoteBy?.includes(sessionId) || false
  const callToVoteNeeded = Math.ceil(activePlayers.length / 2) + 1

  // Play sound when it becomes my turn
  useEffect(() => {
    if (
      isMyTurn &&
      prevTurnIndexRef.current !== room.currentTurnIndex &&
      room.currentTurnIndex !== undefined
    ) {
      playTurnSound()
    }
    prevTurnIndexRef.current = room.currentTurnIndex
  }, [isMyTurn, room.currentTurnIndex])

  // Turn timer
  useEffect(() => {
    if (!room.turnStartTime || !room.turnDurationSeconds || isEliminated) {
      setTurnTimeLeft(null)
      return
    }

    const updateTimer = () => {
      const elapsed = Date.now() - room.turnStartTime!
      const remaining = Math.max(0, room.turnDurationSeconds! * 1000 - elapsed)
      setTurnTimeLeft(Math.ceil(remaining / 1000))

      // Auto-pass when timer expires
      if (remaining <= 0) {
        autoPassTurn({ roomId: room._id }).catch(console.error)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [room.turnStartTime, room.turnDurationSeconds, room._id, isEliminated, autoPassTurn])

  // Show word automatically
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

  const handlePassTurn = async () => {
    setIsPassingTurn(true)
    try {
      await passTurn({ roomId: room._id, sessionId })
    } catch (err) {
      console.error(err)
    } finally {
      setIsPassingTurn(false)
    }
  }

  const handleCallToVote = async () => {
    setIsCallingVote(true)
    try {
      await callToVote({ roomId: room._id, sessionId })
    } catch (err) {
      console.error(err)
    } finally {
      setIsCallingVote(false)
    }
  }

  // Spectator view
  if (isEliminated) {
    return (
      <main className="min-h-screen flex flex-col p-4">
        <div className="w-full max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main game view (spectator) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Spectator banner */}
              <Card className="bg-muted/50 border-dashed border-2">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <Ghost className="w-8 h-8 text-muted-foreground" />
                    <div>
                      <p className="font-bold">Eres espectador</p>
                      <p className="text-sm text-muted-foreground">
                        Fuiste eliminado. Puedes ver el juego y chatear con otros espectadores.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Round indicator */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Ronda {roundNumber} de {totalRounds}
                </span>
                <span className="text-muted-foreground">
                  Jugadores activos: {activePlayers.length}
                </span>
              </div>

              {/* Current turn (viewing only) */}
              {currentTurnPlayer && (
                <Card className="bg-card/50 border-border spectator-overlay">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg font-medium">
                        {currentTurnPlayer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Turno de</p>
                        <p className="font-bold">{currentTurnPlayer.name}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Word reveal (spectators see everything) */}
              {showWord && <WordReveal word={room.currentWord || null} isImpostor={false} />}

              {/* Player list */}
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Jugadores</CardTitle>
                </CardHeader>
                <CardContent>
                  <PlayerList
                    players={activePlayers}
                    currentSessionId={sessionId}
                    turnOrder={room.turnOrder}
                    currentTurnIndex={room.currentTurnIndex}
                  />
                  {spectators.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                        <Ghost className="w-4 h-4" />
                        Espectadores ({spectators.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {spectators.map((p) => (
                          <span
                            key={p._id}
                            className={cn(
                              "px-2 py-1 rounded-full text-xs bg-muted",
                              p.sessionId === sessionId && "ring-1 ring-primary"
                            )}
                          >
                            {p.name}
                            {p.sessionId === sessionId && " (tú)"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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
      <div className="w-full max-w-2xl mx-auto space-y-4">
        {/* Header with round info */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-primary" />
              Fase de discusión
            </h1>
            <p className="text-muted-foreground text-sm">
              {modeConfig.emoji} {modeConfig.name} • {room.category} • Ronda {roundNumber}/{totalRounds}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {activePlayers.length} activos
            </div>
          </div>
        </div>

        {/* Team Display for team_vs_team mode */}
        {isTeamMode && (
          <TeamDisplay room={room} players={players} currentSessionId={sessionId} />
        )}

        {/* Combat View for combate mode */}
        {isCombateMode && room.combatants && (
          <CombatView room={room} players={players} currentSessionId={sessionId} />
        )}

        {/* Doble Agente warning for impostors */}
        {isDobleAgenteMode && isImpostor && (
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertTriangle className="w-5 h-5" />
                <p className="text-sm">
                  Hay otro impostor, pero no sabes quien es. Cuidado de no delatarte mutuamente.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Turn indicator banner with timer */}
        {currentTurnPlayer && (
          <Card
            key={room.currentTurnIndex}
            className={cn(
              "turn-banner",
              isMyTurn ? "bg-green-500/20 border-green-500" : "bg-card border-border"
            )}
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center text-xl font-medium",
                      isMyTurn ? "bg-green-500 text-white turn-active" : "bg-muted"
                    )}
                  >
                    {currentTurnPlayer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Turno de</p>
                    <p className="font-bold text-lg">
                      {isMyTurn ? "¡Tu turno!" : currentTurnPlayer.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Turn timer */}
                  {turnTimeLeft !== null && (
                    <div
                      className={cn(
                        "flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold",
                        turnTimeLeft <= 5
                          ? "bg-red-500/20 text-red-500 animate-pulse"
                          : turnTimeLeft <= 10
                            ? "bg-yellow-500/20 text-yellow-500"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Clock className="w-4 h-4" />
                      {turnTimeLeft}s
                    </div>
                  )}

                  {/* Pass turn button */}
                  {isMyTurn && (
                    <Button
                      onClick={handlePassTurn}
                      disabled={isPassingTurn}
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      {isPassingTurn ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Pasar Turno
                          <ArrowRight className="h-5 w-5 ml-2" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Word reveal */}
        {showWord && <WordReveal word={word} isImpostor={isImpostor} />}

        {/* Instructions */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            {isImpostor ? (
              <div className="text-center space-y-2">
                <p className="text-destructive font-medium">Eres el impostor</p>
                <p className="text-sm text-muted-foreground">
                  No conoces la palabra. Intenta descubrirla sin que te descubran.
                </p>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <p className="text-primary font-medium">Conoces la palabra secreta</p>
                <p className="text-sm text-muted-foreground">
                  Da pistas sin decirla directamente. Encuentra al impostor.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Emoji Panel for Silencio mode */}
        {isSilencioMode && (
          <EmojiPanel roomId={room._id} sessionId={sessionId} disabled={false} />
        )}

        {/* Role Actions for Roles Secretos mode */}
        {isRolesSecretosMode && (
          <>
            <RoleActions
              room={room}
              currentPlayer={currentPlayer}
              players={players}
              sessionId={sessionId}
            />
            <GhostClueDisplay players={players} />
          </>
        )}

        {/* Player list */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Orden de turnos</CardTitle>
          </CardHeader>
          <CardContent>
            <PlayerList
              players={activePlayers}
              currentSessionId={sessionId}
              turnOrder={room.turnOrder}
              currentTurnIndex={room.currentTurnIndex}
            />
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

        {/* Action buttons */}
        <div className="space-y-3">
          {/* Call to vote button (all active players) */}
          {!hasCalledVote && (
            <Button
              onClick={handleCallToVote}
              disabled={isCallingVote || hasCalledVote}
              variant="outline"
              className="w-full"
              size="lg"
            >
              {isCallingVote ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Vote className="h-5 w-5 mr-2" />
                  Ir a Votación ({callToVoteCount}/{callToVoteNeeded})
                </>
              )}
            </Button>
          )}

          {hasCalledVote && (
            <p className="text-center text-sm text-muted-foreground">
              Has votado para ir a votación ({callToVoteCount}/{callToVoteNeeded})
            </p>
          )}

          {/* Host force voting button */}
          {isHost && (
            <Button
              onClick={handleStartVoting}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              size="lg"
            >
              <Vote className="h-5 w-5 mr-2" />
              Forzar Votación (Host)
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
