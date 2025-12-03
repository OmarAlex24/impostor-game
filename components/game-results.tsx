"use client"

import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlayerList } from "@/components/player-list"
import { Scoreboard } from "@/components/scoreboard"
import { GAME_MODES, ROLE_DESCRIPTIONS, type GameModeId, type SecretRole } from "@/convex/gameModes"
import { Trophy, Skull, RotateCcw, Home, RefreshCw, Users } from "lucide-react"
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

  const gameMode = (room.gameMode || "clasico") as GameModeId
  const modeConfig = GAME_MODES[gameMode]

  // Filter active players (who participated in voting)
  const activePlayers = players.filter((p) => !p.isEliminated || p.votedFor)

  // Calcular resultados
  const impostor = players.find((p) => p.sessionId === room.impostorId)
  const impostor2 = room.impostorId2 ? players.find((p) => p.sessionId === room.impostorId2) : null
  const votes: Record<string, number> = {}

  activePlayers.forEach((p) => {
    if (p.votedFor) {
      votes[p.votedFor] = (votes[p.votedFor] || 0) + 1
    }
  })

  // Encontrar el más votado
  let maxVotes = 0
  let mostVoted: string | null = null
  Object.entries(votes).forEach(([sid, count]) => {
    if (count > maxVotes) {
      maxVotes = count
      mostVoted = sid
    }
  })

  // Determine win condition based on mode
  const payasoWon = room.payasoWinner != null
  const impostorCaught = mostVoted === room.impostorId || mostVoted === room.impostorId2
  const isCurrentPlayerImpostor = sessionId === room.impostorId || sessionId === room.impostorId2

  const handlePlayAgain = async () => {
    try {
      await resetRoom({ roomId: room._id, sessionId, resetStats: false })
    } catch (err) {
      console.error(err)
    }
  }

  const handleResetAndPlay = async () => {
    try {
      await resetRoom({ roomId: room._id, sessionId, resetStats: true })
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <main className="min-h-screen flex flex-col p-4">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Mode indicator */}
        <div className="text-center text-sm text-muted-foreground">
          {modeConfig.emoji} Modo {modeConfig.name}
        </div>

        {/* Resultado principal */}
        <Card
          className={`border-2 ${
            payasoWon
              ? "bg-yellow-500/10 border-yellow-500"
              : impostorCaught
                ? "bg-primary/10 border-primary"
                : "bg-destructive/10 border-destructive"
          }`}
        >
          <CardContent className="pt-8 pb-8 text-center">
            {payasoWon ? (
              <>
                <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">🤡</span>
                </div>
                <h1 className="text-3xl font-bold text-yellow-500 mb-2">¡El Payaso gana!</h1>
                <p className="text-muted-foreground">
                  El Payaso logro que lo votaran y escapo victorioso.
                </p>
              </>
            ) : impostorCaught ? (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-primary mb-2">
                  {impostor2 ? "¡Impostores atrapados!" : "¡Impostor atrapado!"}
                </h1>
                <p className="text-muted-foreground">
                  {isCurrentPlayerImpostor
                    ? "Te han descubierto... ¡Mejor suerte la proxima!"
                    : impostor2
                      ? "Han descubierto a ambos impostores. ¡Buen trabajo equipo!"
                      : "Han descubierto al impostor. ¡Buen trabajo equipo!"}
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
                  <Skull className="w-8 h-8 text-destructive" />
                </div>
                <h1 className="text-3xl font-bold text-destructive mb-2">
                  {impostor2 ? "¡Los impostores ganan!" : "¡El impostor gana!"}
                </h1>
                <p className="text-muted-foreground">
                  {isCurrentPlayerImpostor
                    ? "¡Nadie te descubrio! Eres un maestro del engano."
                    : impostor2
                      ? "Los impostores han escapado sin ser detectados."
                      : "El impostor ha escapado sin ser detectado."}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Revelación del impostor(es) */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {impostor2 ? "Los impostores eran..." : "El impostor era..."}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-destructive/10 border border-destructive">
              <div className="w-14 h-14 rounded-full bg-destructive flex items-center justify-center text-2xl font-bold text-destructive-foreground">
                {impostor?.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xl font-bold">{impostor?.name}</p>
                <p className="text-sm text-muted-foreground">Recibio {votes[room.impostorId!] || 0} voto(s)</p>
              </div>
            </div>
            {impostor2 && (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-destructive/10 border border-destructive">
                <div className="w-14 h-14 rounded-full bg-destructive flex items-center justify-center text-2xl font-bold text-destructive-foreground">
                  {impostor2.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xl font-bold">{impostor2.name}</p>
                  <p className="text-sm text-muted-foreground">Recibio {votes[room.impostorId2!] || 0} voto(s)</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Roles Secretos reveal */}
        {gameMode === "roles_secretos" && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Roles secretos revelados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {players.map((p) => {
                  const role = p.secretRole as SecretRole | undefined
                  if (!role || role === "none") return null
                  const roleInfo = ROLE_DESCRIPTIONS[role]
                  return (
                    <div
                      key={p._id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50"
                    >
                      <span className="text-lg">{roleInfo.emoji}</span>
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{roleInfo.name}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team results for team_vs_team */}
        {gameMode === "team_vs_team" && room.teamAssignments && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Equipos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <p className="font-medium text-blue-400 mb-2">Equipo A</p>
                  <div className="space-y-1">
                    {room.teamAssignments.teamA.map((sid) => {
                      const p = players.find((pl) => pl.sessionId === sid)
                      const isTeamImpostor = sid === room.teamAssignments!.teamAImpostor
                      return (
                        <div key={sid} className="flex items-center justify-between text-sm">
                          <span>{p?.name}</span>
                          {isTeamImpostor && <span className="text-destructive text-xs">Impostor</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="font-medium text-red-400 mb-2">Equipo B</p>
                  <div className="space-y-1">
                    {room.teamAssignments.teamB.map((sid) => {
                      const p = players.find((pl) => pl.sessionId === sid)
                      const isTeamImpostor = sid === room.teamAssignments!.teamBImpostor
                      return (
                        <div key={sid} className="flex items-center justify-between text-sm">
                          <span>{p?.name}</span>
                          {isTeamImpostor && <span className="text-destructive text-xs">Impostor</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
              players={activePlayers}
              currentSessionId={sessionId}
              showVotes
              impostorId={room.impostorId}
              showImpostor
            />
          </CardContent>
        </Card>

        {/* Scoreboard */}
        <Scoreboard roomId={room._id} currentSessionId={sessionId} />

        {/* Acciones */}
        <div className="space-y-3">
          {isHost && (
            <>
              <Button
                onClick={handlePlayAgain}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                size="lg"
              >
                <RotateCcw className="h-5 w-5 mr-2" />
                Jugar de nuevo (mantener puntos)
              </Button>
              <Button
                onClick={handleResetAndPlay}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Reiniciar todo (borrar puntos)
              </Button>
            </>
          )}
          <Link href="/" className="block">
            <Button variant="ghost" className="w-full" size="lg">
              <Home className="h-5 w-5 mr-2" />
              Salir de la sala
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
