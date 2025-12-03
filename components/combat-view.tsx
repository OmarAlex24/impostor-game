"use client"

import type { Doc } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { Swords, User } from "lucide-react"

interface CombatViewProps {
  room: Doc<"rooms">
  players: Doc<"players">[]
  currentSessionId: string
}

export function CombatView({ room, players, currentSessionId }: CombatViewProps) {
  if (!room.combatants || room.combatants.length < 2) return null

  const combatant1 = players.find((p) => p.sessionId === room.combatants![0])
  const combatant2 = players.find((p) => p.sessionId === room.combatants![1])

  if (!combatant1 || !combatant2) return null

  const isCurrentPlayerCombatant = room.combatants.includes(currentSessionId)

  // Count votes for each combatant
  const activePlayers = players.filter((p) => !p.isEliminated)
  const votesFor1 = activePlayers.filter((p) => p.votedFor === combatant1.sessionId).length
  const votesFor2 = activePlayers.filter((p) => p.votedFor === combatant2.sessionId).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 text-center">
        <Swords className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-lg">Combate</h3>
      </div>

      {isCurrentPlayerCombatant && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
          <p className="text-sm text-yellow-400">
            Defiende tu inocencia! Los demas votaran quien cae.
          </p>
        </div>
      )}

      {/* Combatants */}
      <div className="grid grid-cols-3 gap-2 items-center">
        <CombatantCard
          player={combatant1}
          votes={votesFor1}
          isCurrentPlayer={combatant1.sessionId === currentSessionId}
        />

        <div className="flex items-center justify-center">
          <div className="bg-destructive/20 rounded-full p-3">
            <span className="text-2xl font-bold text-destructive">VS</span>
          </div>
        </div>

        <CombatantCard
          player={combatant2}
          votes={votesFor2}
          isCurrentPlayer={combatant2.sessionId === currentSessionId}
        />
      </div>

      {!isCurrentPlayerCombatant && (
        <p className="text-center text-sm text-muted-foreground">
          Solo puedes votar por uno de los combatientes
        </p>
      )}
    </div>
  )
}

interface CombatantCardProps {
  player: Doc<"players">
  votes: number
  isCurrentPlayer: boolean
}

function CombatantCard({ player, votes, isCurrentPlayer }: CombatantCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 text-center transition-all",
        isCurrentPlayer
          ? "border-primary bg-primary/10 ring-2 ring-primary"
          : "border-border bg-card"
      )}
    >
      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-2">
        <User className="w-6 h-6" />
      </div>
      <p className="font-medium truncate">{player.name}</p>
      {isCurrentPlayer && (
        <span className="text-xs text-primary">(Tu)</span>
      )}
      <div className="mt-2 pt-2 border-t border-border">
        <p className="text-sm text-muted-foreground">
          Votos: <span className="font-bold text-foreground">{votes}</span>
        </p>
      </div>
    </div>
  )
}
