import { mutation, query, internalMutation, MutationCtx } from "./_generated/server"
import { v } from "convex/values"
import { getRandomWordWeighted } from "./words"

const INACTIVE_ROOM_TIMEOUT = 10 * 60 * 1000 // 10 minutes

// Helper function to cleanup inactive rooms
async function cleanupInactiveRooms(ctx: MutationCtx) {
  const cutoffTime = Date.now() - INACTIVE_ROOM_TIMEOUT

  // Get all rooms
  const rooms = await ctx.db.query("rooms").collect()

  for (const room of rooms) {
    // Delete rooms that haven't had activity in 10+ minutes
    if (room.lastActivityAt < cutoffTime) {
      // Delete all players in the room first
      const players = await ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect()

      for (const player of players) {
        await ctx.db.delete(player._id)
      }

      await ctx.db.delete(room._id)
    }
  }
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export const create = mutation({
  args: {
    hostName: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Cleanup inactive rooms before creating new one
    await cleanupInactiveRooms(ctx)

    // Generar código único
    let code = generateRoomCode()
    let existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first()

    while (existing) {
      code = generateRoomCode()
      existing = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first()
    }

    // Crear sala
    const roomId = await ctx.db.insert("rooms", {
      code,
      hostId: args.sessionId,
      status: "waiting",
      lastActivityAt: Date.now(),
    })

    // Crear jugador host
    await ctx.db.insert("players", {
      roomId,
      sessionId: args.sessionId,
      name: args.hostName,
      isHost: true,
      isReady: false,
      isEliminated: false,
      joinedAt: Date.now(),
    })

    return { code, roomId }
  },
})

export const join = mutation({
  args: {
    code: v.string(),
    playerName: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Cleanup inactive rooms before joining
    await cleanupInactiveRooms(ctx)

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first()

    if (!room) {
      throw new Error("Sala no encontrada")
    }

    if (room.status !== "waiting") {
      throw new Error("La partida ya ha comenzado")
    }

    // Update last activity
    await ctx.db.patch(room._id, { lastActivityAt: Date.now() })

    // Verificar si ya está en la sala
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .first()

    if (existingPlayer) {
      return { roomId: room._id, playerId: existingPlayer._id }
    }

    // Crear nuevo jugador
    const playerId = await ctx.db.insert("players", {
      roomId: room._id,
      sessionId: args.sessionId,
      name: args.playerName,
      isHost: false,
      isReady: false,
      isEliminated: false,
      joinedAt: Date.now(),
    })

    return { roomId: room._id, playerId }
  },
})

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first()
  },
})

export const get = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.roomId)
  },
})

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Constants
const DEFAULT_TURN_DURATION_SECONDS = 30
const DEFAULT_ROUNDS_PER_VOTING = 2

export const startGame = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    category: v.string(),
    discussionMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.hostId !== args.sessionId) throw new Error("Solo el host puede iniciar")

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    // Only count non-eliminated players
    const activePlayers = players.filter((p) => !p.isEliminated)

    if (activePlayers.length < 3) {
      throw new Error("Se necesitan al menos 3 jugadores activos")
    }

    // Seleccionar impostor aleatorio (only from active players if not set)
    let impostorSessionId = room.impostorId
    if (!impostorSessionId || !activePlayers.some((p) => p.sessionId === impostorSessionId)) {
      const impostorIndex = Math.floor(Math.random() * activePlayers.length)
      impostorSessionId = activePlayers[impostorIndex].sessionId
    }

    // Obtener palabra aleatoria con peso (palabras usadas tienen menor probabilidad)
    const usedWords = room.usedWords || []
    const word = room.currentWord || getRandomWordWeighted(args.category, usedWords)

    // Calcular tiempo de fin de discusión
    const discussionEndTime = Date.now() + args.discussionMinutes * 60 * 1000

    // Crear orden de turnos aleatorio (only active players)
    const activeSessionIds = activePlayers.map((p) => p.sessionId)
    const turnOrder = shuffleArray(activeSessionIds)

    // Initialize/reset player stats and votes
    for (const player of players) {
      const isImpostor = player.sessionId === impostorSessionId
      await ctx.db.patch(player._id, {
        votedFor: undefined,
        // Initialize stats if not set
        points: player.points ?? 0,
        correctVotes: player.correctVotes ?? 0,
        timesAsImpostor: isImpostor ? (player.timesAsImpostor ?? 0) + 1 : (player.timesAsImpostor ?? 0),
        impostorWins: player.impostorWins ?? 0,
        survivedRounds: player.survivedRounds ?? 0,
      })
    }

    await ctx.db.patch(args.roomId, {
      status: "playing",
      category: args.category,
      currentWord: word,
      impostorId: impostorSessionId,
      discussionEndTime,
      votingEndTime: undefined,
      lastActivityAt: Date.now(),
      // Turn system
      turnOrder,
      currentTurnIndex: 0,
      // Round system
      roundNumber: 1,
      totalRoundsPerVoting: DEFAULT_ROUNDS_PER_VOTING,
      // Turn cooldown
      turnStartTime: Date.now(),
      turnDurationSeconds: DEFAULT_TURN_DURATION_SECONDS,
      // Call to vote
      callToVoteBy: [],
      // Word history - add to used words (only if new word)
      usedWords: room.currentWord ? usedWords : [...usedWords, word],
    })

    return { word, impostorId: impostorSessionId }
  },
})

export const startVoting = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.hostId !== args.sessionId) throw new Error("Solo el host puede iniciar votación")

    const votingEndTime = Date.now() + 30 * 1000 // 30 segundos para votar

    await ctx.db.patch(args.roomId, {
      status: "voting",
      votingEndTime,
      lastActivityAt: Date.now(),
    })
  },
})

export const showResults = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")

    await ctx.db.patch(args.roomId, {
      status: "results",
    })
  },
})

export const resetRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    resetStats: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.hostId !== args.sessionId) throw new Error("Solo el host puede reiniciar")

    // Resetear jugadores
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    for (const player of players) {
      const playerPatch: Record<string, any> = {
        isReady: false,
        votedFor: undefined,
        isEliminated: false,
      }

      // Optionally reset stats
      if (args.resetStats) {
        playerPatch.points = 0
        playerPatch.correctVotes = 0
        playerPatch.timesAsImpostor = 0
        playerPatch.impostorWins = 0
        playerPatch.survivedRounds = 0
      }

      await ctx.db.patch(player._id, playerPatch)
    }

    // Delete all messages when resetting
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    for (const message of messages) {
      await ctx.db.delete(message._id)
    }

    await ctx.db.patch(args.roomId, {
      status: "waiting",
      currentWord: undefined,
      impostorId: undefined,
      category: undefined,
      discussionEndTime: undefined,
      votingEndTime: undefined,
      lastActivityAt: Date.now(),
      // Clear turn system
      turnOrder: undefined,
      currentTurnIndex: undefined,
      // Clear round system
      roundNumber: undefined,
      totalRoundsPerVoting: undefined,
      // Clear turn cooldown
      turnStartTime: undefined,
      turnDurationSeconds: undefined,
      // Clear call to vote
      callToVoteBy: undefined,
      // NOTE: usedWords is NOT cleared - it persists across games
    })
  },
})

// Pass turn to next player (handles round transitions)
export const passTurn = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.status !== "playing") throw new Error("No se puede pasar turno fuera del juego")
    if (!room.turnOrder || room.currentTurnIndex === undefined) {
      throw new Error("Sistema de turnos no inicializado")
    }

    // Verify it's the caller's turn
    const currentTurnSessionId = room.turnOrder[room.currentTurnIndex]
    if (currentTurnSessionId !== args.sessionId) {
      throw new Error("No es tu turno")
    }

    const nextTurnIndex = room.currentTurnIndex + 1
    const roundNumber = room.roundNumber || 1
    const totalRounds = room.totalRoundsPerVoting || DEFAULT_ROUNDS_PER_VOTING

    // Check if we've completed a full round
    if (nextTurnIndex >= room.turnOrder.length) {
      // Completed a round
      if (roundNumber >= totalRounds) {
        // All rounds done - go to voting
        const votingEndTime = Date.now() + 30 * 1000
        await ctx.db.patch(args.roomId, {
          status: "voting",
          votingEndTime,
          lastActivityAt: Date.now(),
        })
        return { roundComplete: true, startedVoting: true }
      } else {
        // Move to next round
        await ctx.db.patch(args.roomId, {
          currentTurnIndex: 0,
          roundNumber: roundNumber + 1,
          turnStartTime: Date.now(),
          lastActivityAt: Date.now(),
        })
        return { roundComplete: true, startedVoting: false, newRound: roundNumber + 1 }
      }
    }

    // Normal turn advance
    await ctx.db.patch(args.roomId, {
      currentTurnIndex: nextTurnIndex,
      turnStartTime: Date.now(),
      lastActivityAt: Date.now(),
    })
    return { roundComplete: false, startedVoting: false }
  },
})

// Auto-pass turn when timer expires (called by client)
export const autoPassTurn = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.status !== "playing") return { skipped: true }
    if (!room.turnOrder || room.currentTurnIndex === undefined) return { skipped: true }

    // Validate that turn time has expired
    const turnDuration = (room.turnDurationSeconds || DEFAULT_TURN_DURATION_SECONDS) * 1000
    const turnStartTime = room.turnStartTime || Date.now()
    const elapsed = Date.now() - turnStartTime

    if (elapsed < turnDuration - 1000) {
      // Allow 1 second tolerance
      return { skipped: true, reason: "Turn not expired yet" }
    }

    // Get current player's sessionId for passTurn call
    const currentSessionId = room.turnOrder[room.currentTurnIndex]

    // Pass the turn (reuse passTurn logic)
    const nextTurnIndex = room.currentTurnIndex + 1
    const roundNumber = room.roundNumber || 1
    const totalRounds = room.totalRoundsPerVoting || DEFAULT_ROUNDS_PER_VOTING

    if (nextTurnIndex >= room.turnOrder.length) {
      if (roundNumber >= totalRounds) {
        const votingEndTime = Date.now() + 30 * 1000
        await ctx.db.patch(args.roomId, {
          status: "voting",
          votingEndTime,
          lastActivityAt: Date.now(),
        })
        return { autoPassedTo: "voting" }
      } else {
        await ctx.db.patch(args.roomId, {
          currentTurnIndex: 0,
          roundNumber: roundNumber + 1,
          turnStartTime: Date.now(),
          lastActivityAt: Date.now(),
        })
        return { autoPassedTo: "nextRound" }
      }
    }

    await ctx.db.patch(args.roomId, {
      currentTurnIndex: nextTurnIndex,
      turnStartTime: Date.now(),
      lastActivityAt: Date.now(),
    })
    return { autoPassedTo: room.turnOrder[nextTurnIndex] }
  },
})

// Call to vote - skip to voting early
export const callToVote = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.status !== "playing") throw new Error("Solo se puede llamar a votación durante el juego")

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    const activePlayers = players.filter((p) => !p.isEliminated)
    const currentCalls = room.callToVoteBy || []

    // Check if player already called
    if (currentCalls.includes(args.sessionId)) {
      throw new Error("Ya has llamado a votación")
    }

    const newCalls = [...currentCalls, args.sessionId]

    // Check if majority reached or host called
    const isHost = room.hostId === args.sessionId
    const majorityReached = newCalls.length > activePlayers.length / 2

    if (isHost || majorityReached) {
      // Start voting immediately
      const votingEndTime = Date.now() + 30 * 1000
      await ctx.db.patch(args.roomId, {
        status: "voting",
        votingEndTime,
        lastActivityAt: Date.now(),
        callToVoteBy: newCalls,
      })
      return { votingStarted: true, votes: newCalls.length, needed: Math.ceil(activePlayers.length / 2) + 1 }
    }

    // Just record the call
    await ctx.db.patch(args.roomId, {
      callToVoteBy: newCalls,
      lastActivityAt: Date.now(),
    })

    return { votingStarted: false, votes: newCalls.length, needed: Math.ceil(activePlayers.length / 2) + 1 }
  },
})

// Process voting results - handles elimination and game continuation
export const processVotingResults = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.hostId !== args.sessionId) throw new Error("Solo el host puede procesar resultados")

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    const activePlayers = players.filter((p) => !p.isEliminated)

    // Count votes
    const votes: Record<string, number> = {}
    for (const p of activePlayers) {
      if (p.votedFor) {
        votes[p.votedFor] = (votes[p.votedFor] || 0) + 1
      }
    }

    // Find most voted
    let mostVotedSessionId = ""
    let maxVotes = 0
    for (const [sessionId, voteCount] of Object.entries(votes)) {
      if (voteCount > maxVotes) {
        maxVotes = voteCount
        mostVotedSessionId = sessionId
      }
    }

    const impostorCaught = mostVotedSessionId === room.impostorId
    const impostorPlayer = players.find((p) => p.sessionId === room.impostorId)

    // Award points
    for (const player of activePlayers) {
      let pointsToAdd = 0

      if (impostorCaught) {
        // Impostor was caught
        if (player.votedFor === room.impostorId) {
          // Voted correctly
          pointsToAdd += 100
          await ctx.db.patch(player._id, {
            correctVotes: (player.correctVotes || 0) + 1,
          })
        }
      } else {
        // Impostor survived this round
        if (player.sessionId === room.impostorId) {
          // Impostor gets survival points
          pointsToAdd += 50
        } else if (player.sessionId !== mostVotedSessionId) {
          // Non-eliminated players get survival points
          pointsToAdd += 25
          await ctx.db.patch(player._id, {
            survivedRounds: (player.survivedRounds || 0) + 1,
          })
        }
      }

      if (pointsToAdd > 0) {
        await ctx.db.patch(player._id, {
          points: (player.points || 0) + pointsToAdd,
        })
      }
    }

    if (impostorCaught) {
      // Game ends - impostor loses
      await ctx.db.patch(args.roomId, {
        status: "results",
        lastActivityAt: Date.now(),
      })
      return { gameOver: true, impostorCaught: true, eliminatedSessionId: mostVotedSessionId }
    }

    // Eliminate the most voted player
    const eliminatedPlayer = players.find((p) => p.sessionId === mostVotedSessionId)
    if (eliminatedPlayer) {
      await ctx.db.patch(eliminatedPlayer._id, {
        isEliminated: true,
      })
    }

    // Check remaining players
    const remainingActive = activePlayers.filter((p) => p.sessionId !== mostVotedSessionId)
    const remainingNonImpostors = remainingActive.filter((p) => p.sessionId !== room.impostorId)

    if (remainingNonImpostors.length <= 1) {
      // Impostor wins - only 1 non-impostor left (or less)
      if (impostorPlayer) {
        await ctx.db.patch(impostorPlayer._id, {
          points: (impostorPlayer.points || 0) + 150,
          impostorWins: (impostorPlayer.impostorWins || 0) + 1,
        })
      }

      await ctx.db.patch(args.roomId, {
        status: "results",
        lastActivityAt: Date.now(),
      })
      return { gameOver: true, impostorCaught: false, impostorWins: true, eliminatedSessionId: mostVotedSessionId }
    }

    // Game continues - go back to discussion with remaining players
    // Reset for new round of discussion
    const remainingSessionIds = remainingActive.map((p) => p.sessionId)
    const newTurnOrder = shuffleArray(remainingSessionIds)

    // Reset votes for active players
    for (const player of remainingActive) {
      await ctx.db.patch(player._id, {
        votedFor: undefined,
      })
    }

    await ctx.db.patch(args.roomId, {
      status: "playing",
      roundNumber: 1,
      currentTurnIndex: 0,
      turnOrder: newTurnOrder,
      turnStartTime: Date.now(),
      votingEndTime: undefined,
      callToVoteBy: [],
      lastActivityAt: Date.now(),
    })

    return { gameOver: false, eliminatedSessionId: mostVotedSessionId, continuingWithPlayers: remainingActive.length }
  },
})
