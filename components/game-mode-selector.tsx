"use client"

import { cn } from "@/lib/utils"
import { GAME_MODES, type GameModeId } from "@/convex/gameModes"
import { Check } from "lucide-react"

interface GameModeSelectorProps {
  selectedMode: GameModeId
  onSelectMode: (mode: GameModeId) => void
  playerCount: number
}

const MODE_ORDER: GameModeId[] = ["clasico", "doble_agente", "silencio", "roles_secretos", "team_vs_team", "combate"]

export function GameModeSelector({ selectedMode, onSelectMode, playerCount }: GameModeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {MODE_ORDER.map((modeId) => {
        const mode = GAME_MODES[modeId]
        const isDisabled = playerCount < mode.minPlayers
        const isSelected = selectedMode === modeId

        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => !isDisabled && onSelectMode(modeId)}
            disabled={isDisabled}
            className={cn(
              "relative flex flex-col items-start p-3 rounded-lg border text-left transition-all",
              "bg-secondary/50 hover:bg-secondary",
              isSelected && "ring-2 ring-primary border-primary bg-primary/10",
              isDisabled && "opacity-40 cursor-not-allowed hover:bg-secondary/50"
            )}
          >
            {isSelected && (
              <div className="absolute top-2 right-2">
                <Check className="w-4 h-4 text-primary" />
              </div>
            )}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{mode.emoji}</span>
              <span className="font-medium text-sm">{mode.name}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {mode.description}
            </p>
            <p className={cn(
              "text-xs mt-1",
              isDisabled ? "text-destructive" : "text-muted-foreground"
            )}>
              Min: {mode.minPlayers} jugadores
            </p>
          </button>
        )
      })}
    </div>
  )
}
