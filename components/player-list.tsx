"use client"

import type { Doc } from "@/convex/_generated/dataModel"
import { Crown, Check, Vote } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlayerListProps {
  players: Doc<"players">[]
  currentSessionId: string
  showReady?: boolean
  showVotes?: boolean
  votingFor?: string | null
  onVote?: (sessionId: string) => void
  impostorId?: string
  showImpostor?: boolean
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
}: PlayerListProps) {
  // Ordenar: host primero, luego por nombre
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.isHost && !b.isHost) return -1
    if (!a.isHost && b.isHost) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="space-y-2">
      {sortedPlayers.map((player) => {
        const isMe = player.sessionId === currentSessionId
        const isImpostor = showImpostor && player.sessionId === impostorId
        const isVotedFor = votingFor === player.sessionId
        const votesReceived = showVotes ? players.filter((p) => p.votedFor === player.sessionId).length : 0

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
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium",
                  isImpostor ? "bg-destructive text-destructive-foreground" : "bg-muted",
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
