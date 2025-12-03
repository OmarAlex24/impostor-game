// Game mode configurations
export type GameModeId = "clasico" | "doble_agente" | "silencio" | "roles_secretos" | "team_vs_team" | "combate"

export type SecretRole = "detective" | "fiscal" | "payaso" | "doble_votante" | "fantasma" | "none"

export interface GameModeConfig {
  id: GameModeId
  name: string
  emoji: string
  description: string
  minPlayers: number
  maxImpostors: number
  specialRoles: SecretRole[]
  features: {
    chatEnabled: boolean
    teamsEnabled: boolean
    combatEnabled: boolean
    emojiOnly: boolean
  }
}

export const GAME_MODES: Record<GameModeId, GameModeConfig> = {
  clasico: {
    id: "clasico",
    name: "Clasico",
    emoji: "🎮",
    description: "1 impostor, 1 palabra secreta, debate normal",
    minPlayers: 3,
    maxImpostors: 1,
    specialRoles: [],
    features: { chatEnabled: true, teamsEnabled: false, combatEnabled: false, emojiOnly: false },
  },
  doble_agente: {
    id: "doble_agente",
    name: "Doble Agente",
    emoji: "🔥",
    description: "2 impostores que NO se conocen entre si",
    minPlayers: 5,
    maxImpostors: 2,
    specialRoles: [],
    features: { chatEnabled: true, teamsEnabled: false, combatEnabled: false, emojiOnly: false },
  },
  silencio: {
    id: "silencio",
    name: "Silencio",
    emoji: "🤐",
    description: "Nadie puede hablar, solo emojis y votaciones",
    minPlayers: 3,
    maxImpostors: 1,
    specialRoles: [],
    features: { chatEnabled: false, teamsEnabled: false, combatEnabled: false, emojiOnly: true },
  },
  roles_secretos: {
    id: "roles_secretos",
    name: "Roles Secretos",
    emoji: "🎭",
    description: "Detective, Fiscal, Payaso y mas roles especiales",
    minPlayers: 5,
    maxImpostors: 1,
    specialRoles: ["detective", "fiscal", "payaso", "doble_votante", "fantasma"],
    features: { chatEnabled: true, teamsEnabled: false, combatEnabled: false, emojiOnly: false },
  },
  team_vs_team: {
    id: "team_vs_team",
    name: "Team vs Team",
    emoji: "🎯",
    description: "2 equipos, 1 impostor por equipo",
    minPlayers: 6,
    maxImpostors: 2,
    specialRoles: [],
    features: { chatEnabled: true, teamsEnabled: true, combatEnabled: false, emojiOnly: false },
  },
  combate: {
    id: "combate",
    name: "Combate",
    emoji: "⚔️",
    description: "2 jugadores defienden su inocencia, los demas votan",
    minPlayers: 4,
    maxImpostors: 1,
    specialRoles: [],
    features: { chatEnabled: true, teamsEnabled: false, combatEnabled: true, emojiOnly: false },
  },
}

// Helper to get mode config with fallback to clasico
export function getGameModeConfig(modeId: string | undefined): GameModeConfig {
  return GAME_MODES[modeId as GameModeId] || GAME_MODES.clasico
}

// Emojis for Silencio mode
export const SILENCIO_EMOJIS = ["👍", "👎", "🤔", "😱", "🤥", "👀", "❌", "✅", "🎯", "💀", "😈", "🤫"]

// Role descriptions for Roles Secretos mode
export const ROLE_DESCRIPTIONS: Record<SecretRole, { name: string; emoji: string; description: string }> = {
  detective: {
    name: "Detective",
    emoji: "🔍",
    description: "Puedes investigar a un jugador una vez para saber si es impostor",
  },
  fiscal: {
    name: "Fiscal",
    emoji: "⚖️",
    description: "Puedes llamar a votacion temprana una vez por partida",
  },
  payaso: {
    name: "Payaso",
    emoji: "🤡",
    description: "Ganas si logras que te voten aunque no seas impostor",
  },
  doble_votante: {
    name: "Votante Doble",
    emoji: "✌️",
    description: "Tu voto cuenta doble en las votaciones",
  },
  fantasma: {
    name: "Fantasma",
    emoji: "👻",
    description: "Si te eliminan, puedes dejar una pista para los demas",
  },
  none: {
    name: "Ciudadano",
    emoji: "👤",
    description: "Jugador normal sin habilidades especiales",
  },
}
