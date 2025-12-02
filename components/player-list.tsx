"use client"

import type { Doc, Id } from "@/convex/_generated/dataModel"
import { Crown, Check, Vote, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface PlayerListProps {
  players: Doc<"players">[]
  currentSessionId: string
  showReady?: boolean
  showVotes?: boolean
  votingFor?: string | null
  onVote?: (sessionId: string) => void
  impostorId?: string
  showImpostor?: boolean
  // Kick functionality
  canKick?: boolean
  onKick?: (playerId: Id<"players">, playerName: string) => void
  // Turn system
  turnOrder?: string[]
  currentTurnIndex?: number
}

export function PlayerList({
  players,
  currentSessionId,
  showReady = false,
  showVotes = false,
  votingFor,
  onVote,
  impostorId,
  showImpostor = false,
  canKick = false,
  onKick,
  turnOrder,
  currentTurnIndex,
}: PlayerListProps) {
  // Ordenar: host primero, luego por nombre (unless we have turn order)
  const sortedPlayers = turnOrder
    ? [...players].sort((a, b) => {
        const aIndex = turnOrder.indexOf(a.sessionId)
        const bIndex = turnOrder.indexOf(b.sessionId)
        return aIndex - bIndex
      })
    : [...players].sort((a, b) => {
        if (a.isHost && !b.isHost) return -1
        if (!a.isHost && b.isHost) return 1
        return a.name.localeCompare(b.name)
      })

  // Get current turn player's sessionId
  const currentTurnSessionId = turnOrder && currentTurnIndex !== undefined ? turnOrder[currentTurnIndex] : null

  return (
    <div className="space-y-2">
      {sortedPlayers.map((player, index) => {
        const isMe = player.sessionId === currentSessionId
        const isImpostor = showImpostor && player.sessionId === impostorId
        const isVotedFor = votingFor === player.sessionId
        const votesReceived = showVotes ? players.filter((p) => p.votedFor === player.sessionId).length : 0
        const isCurrentTurn = currentTurnSessionId === player.sessionId
        const turnNumber = turnOrder ? turnOrder.indexOf(player.sessionId) + 1 : null

        return (
          <div
            key={player._id}
            onClick={() => onVote && !isMe && onVote(player.sessionId)}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg transition-all",
              isImpostor ? "bg-destructive/20 border border-destructive" : "bg-secondary",
              isVotedFor && "ring-2 ring-primary",
              onVote && !isMe && "cursor-pointer hover:bg-secondary/80",
              isMe && "ring-1 ring-primary/50",
              isCurrentTurn && "ring-2 ring-green-500 bg-green-500/10",
            )}
          >
            <div className="flex items-center gap-3">
              {/* Turn number indicator */}
              {turnNumber && (
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    isCurrentTurn ? "bg-green-500 text-white turn-active" : "bg-muted text-muted-foreground",
                  )}
                >
                  {turnNumber}
                </div>
              )}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium",
                  isImpostor ? "bg-destructive text-destructive-foreground" : "bg-muted",
                  isCurrentTurn && !isImpostor && "bg-green-500 text-white",
                )}
              >
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {player.name}
                    {isMe && <span className="text-muted-foreground ml-1">(tú)</span>}
                  </span>
                  {player.isHost && <Crown className="w-4 h-4 text-yellow-500" />}
                  {isCurrentTurn && (
                    <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Turno</span>
                  )}
                </div>
                {isImpostor && <span className="text-sm text-destructive">Impostor</span>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {showReady && !player.isHost && (
                <div
                  className={cn(
                    "px-2 py-1 rounded text-xs font-medium",
                    player.isReady ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {player.isReady ? (
                    <span className="flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Listo
                    </span>
                  ) : (
                    "Esperando..."
                  )}
                </div>
              )}

              {showVotes && votesReceived > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-destructive/20 text-destructive text-sm font-medium">
                  <Vote className="w-4 h-4" />
                  {votesReceived}
                </div>
              )}

              {/* Kick button - only visible to host, not for self */}
              {canKick && onKick && !isMe && !player.isHost && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    onKick(player._id, player.name)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
