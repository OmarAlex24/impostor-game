"use client"

import type { Doc } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { Users, Skull, Crown } from "lucide-react"

interface TeamDisplayProps {
  room: Doc<"rooms">
  players: Doc<"players">[]
  currentSessionId: string
}

export function TeamDisplay({ room, players, currentSessionId }: TeamDisplayProps) {
  if (!room.teamAssignments) return null

  const { teamA, teamB } = room.teamAssignments
  const currentPlayer = players.find((p) => p.sessionId === currentSessionId)
  const currentTeam = currentPlayer?.team

  const teamAPlayers = players.filter((p) => teamA.includes(p.sessionId))
  const teamBPlayers = players.filter((p) => teamB.includes(p.sessionId))

  return (
    <div className="grid grid-cols-2 gap-3">
      <TeamCard
        team="A"
        players={teamAPlayers}
        isCurrentTeam={currentTeam === "A"}
        hostId={room.hostId}
      />
      <TeamCard
        team="B"
        players={teamBPlayers}
        isCurrentTeam={currentTeam === "B"}
        hostId={room.hostId}
      />
    </div>
  )
}

interface TeamCardProps {
  team: "A" | "B"
  players: Doc<"players">[]
  isCurrentTeam: boolean
  hostId: string
}

function TeamCard({ team, players, isCurrentTeam, hostId }: TeamCardProps) {
  const teamColor = team === "A" ? "blue" : "red"
  const activePlayers = players.filter((p) => !p.isEliminated)
  const eliminatedPlayers = players.filter((p) => p.isEliminated)

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        team === "A" ? "border-blue-500/30 bg-blue-500/5" : "border-red-500/30 bg-red-500/5",
        isCurrentTeam && "ring-2 ring-offset-2 ring-offset-background",
        isCurrentTeam && (team === "A" ? "ring-blue-500" : "ring-red-500")
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users className={cn("w-4 h-4", team === "A" ? "text-blue-400" : "text-red-400")} />
          <span className={cn("font-medium text-sm", team === "A" ? "text-blue-400" : "text-red-400")}>
            Equipo {team}
          </span>
        </div>
        {isCurrentTeam && (
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Tu equipo</span>
        )}
      </div>

      <div className="space-y-1">
        {activePlayers.map((player) => (
          <div
            key={player._id}
            className={cn(
              "flex items-center gap-2 text-sm px-2 py-1 rounded",
              team === "A" ? "bg-blue-500/10" : "bg-red-500/10"
            )}
          >
            {player.isHost && <Crown className="w-3 h-3 text-yellow-500" />}
            <span>{player.name}</span>
          </div>
        ))}
        {eliminatedPlayers.map((player) => (
          <div
            key={player._id}
            className="flex items-center gap-2 text-sm px-2 py-1 rounded bg-muted/30 text-muted-foreground line-through"
          >
            <Skull className="w-3 h-3" />
            <span>{player.name}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          Activos: {activePlayers.length} / {players.length}
        </p>
      </div>
    </div>
  )
}
