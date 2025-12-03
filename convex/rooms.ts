import { mutation, query, internalMutation, MutationCtx } from "./_generated/server"
import { v } from "convex/values"
import { getRandomWordWeighted } from "./words"
import { GAME_MODES, type GameModeId, type SecretRole } from "./gameModes"

const INACTIVE_ROOM_TIMEOUT = 10 * 60 * 1000 // 10 minutes

// Helper function to cleanup inactive rooms
async function cleanupInactiveRooms(ctx: MutationCtx) {
  const cutoffTime = Date.now() - INACTIVE_ROOM_TIMEOUT

  // Get all rooms
  const rooms = await ctx.db.query("rooms").collect()

  for (const room of rooms) {
    // Delete rooms that haven't had activity in 10+ minutes (or have no lastActivityAt)
    if (!room.lastActivityAt || room.lastActivityAt < cutoffTime) {
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
    gameMode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.hostId !== args.sessionId) throw new Error("Solo el host puede iniciar")

    const mode = (args.gameMode || "clasico") as GameModeId
    const modeConfig = GAME_MODES[mode] || GAME_MODES.clasico

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    // Only count non-eliminated players
    const activePlayers = players.filter((p) => !p.isEliminated)

    if (activePlayers.length < modeConfig.minPlayers) {
      throw new Error(`Se necesitan al menos ${modeConfig.minPlayers} jugadores para ${modeConfig.name}`)
    }

    // Obtener palabra aleatoria con peso (palabras usadas tienen menor probabilidad)
    const usedWords = room.usedWords || []
    const word = room.currentWord || getRandomWordWeighted(args.category, usedWords)

    // Calcular tiempo de fin de discusión
    const discussionEndTime = Date.now() + args.discussionMinutes * 60 * 1000

    // Crear orden de turnos aleatorio (only active players)
    const activeSessionIds = activePlayers.map((p) => p.sessionId)
    const turnOrder = shuffleArray(activeSessionIds)

    // Mode-specific setup
    let impostorSessionId: string | undefined
    let impostorSessionId2: string | undefined
    let teamAssignments: { teamA: string[]; teamB: string[]; teamAImpostor: string; teamBImpostor: string } | undefined
    let combatants: string[] | undefined

    // Select impostors based on mode
    switch (mode) {
      case "doble_agente": {
        // Select 2 random impostors who don't know each other
        const shuffled = shuffleArray([...activePlayers])
        impostorSessionId = shuffled[0].sessionId
        impostorSessionId2 = shuffled[1].sessionId
        break
      }
      case "team_vs_team": {
        // Split into 2 teams with 1 impostor each
        const shuffled = shuffleArray([...activePlayers])
        const midpoint = Math.floor(shuffled.length / 2)
        const teamA = shuffled.slice(0, midpoint).map(p => p.sessionId)
        const teamB = shuffled.slice(midpoint).map(p => p.sessionId)

        // Select 1 impostor per team
        const teamAImpostor = teamA[Math.floor(Math.random() * teamA.length)]
        const teamBImpostor = teamB[Math.floor(Math.random() * teamB.length)]

        impostorSessionId = teamAImpostor
        impostorSessionId2 = teamBImpostor
        teamAssignments = { teamA, teamB, teamAImpostor, teamBImpostor }
        break
      }
      case "combate": {
        // Select 2 random combatants
        const shuffled = shuffleArray([...activePlayers])
        combatants = [shuffled[0].sessionId, shuffled[1].sessionId]
        // Select 1 impostor normally
        const impostorIndex = Math.floor(Math.random() * activePlayers.length)
        impostorSessionId = activePlayers[impostorIndex].sessionId
        break
      }
      default: {
        // clasico, silencio, roles_secretos - 1 impostor
        let selectedImpostor = room.impostorId
        if (!selectedImpostor || !activePlayers.some((p) => p.sessionId === selectedImpostor)) {
          const impostorIndex = Math.floor(Math.random() * activePlayers.length)
          selectedImpostor = activePlayers[impostorIndex].sessionId
        }
        impostorSessionId = selectedImpostor
      }
    }

    // Assign secret roles for roles_secretos mode
    const secretRoles: SecretRole[] = ["detective", "fiscal", "payaso", "doble_votante", "fantasma"]

    // Initialize/reset player stats and votes
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      const isImpostor = player.sessionId === impostorSessionId || player.sessionId === impostorSessionId2

      // Determine player team for team_vs_team mode
      let playerTeam: string | undefined
      if (mode === "team_vs_team" && teamAssignments) {
        playerTeam = teamAssignments.teamA.includes(player.sessionId) ? "A" : "B"
      }

      // Assign secret role for roles_secretos mode (non-impostors only)
      let secretRole: SecretRole | undefined
      if (mode === "roles_secretos" && !isImpostor && !player.isEliminated) {
        const activeIndex = activePlayers.findIndex(p => p._id === player._id)
        if (activeIndex !== -1 && activeIndex < secretRoles.length) {
          secretRole = secretRoles[activeIndex]
        } else {
          secretRole = "none"
        }
      }

      await ctx.db.patch(player._id, {
        votedFor: undefined,
        secondVote: undefined,
        // Initialize stats if not set
        points: player.points ?? 0,
        correctVotes: player.correctVotes ?? 0,
        timesAsImpostor: isImpostor ? (player.timesAsImpostor ?? 0) + 1 : (player.timesAsImpostor ?? 0),
        impostorWins: player.impostorWins ?? 0,
        survivedRounds: player.survivedRounds ?? 0,
        // Mode-specific fields
        secretRole: secretRole,
        hasUsedAbility: false,
        ghostClue: undefined,
        team: playerTeam,
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
      // Game mode specific
      gameMode: mode,
      impostorId2: impostorSessionId2,
      teamAssignments,
      combatants,
      payasoWinner: undefined,
    })

    return { word, impostorId: impostorSessionId, impostorId2: impostorSessionId2, gameMode: mode }
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
        // Clear mode-specific fields
        secretRole: undefined,
        hasUsedAbility: undefined,
        ghostClue: undefined,
        secondVote: undefined,
        team: undefined,
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
      // Clear game mode specific fields
      gameMode: undefined,
      impostorId2: undefined,
      teamAssignments: undefined,
      combatants: undefined,
      payasoWinner: undefined,
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

    const mode = (room.gameMode || "clasico") as GameModeId

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    const activePlayers = players.filter((p) => !p.isEliminated)

    // Count votes (with doble_votante counting double)
    const votes: Record<string, number> = {}
    for (const p of activePlayers) {
      if (p.votedFor) {
        // Doble votante's vote counts twice
        const voteWeight = (mode === "roles_secretos" && p.secretRole === "doble_votante") ? 2 : 1
        votes[p.votedFor] = (votes[p.votedFor] || 0) + voteWeight
      }
      // Count second vote if doble_votante
      if (p.secondVote && mode === "roles_secretos" && p.secretRole === "doble_votante") {
        votes[p.secondVote] = (votes[p.secondVote] || 0) + 1
      }
    }

    // For combate mode, only count votes for combatants
    if (mode === "combate" && room.combatants) {
      for (const key of Object.keys(votes)) {
        if (!room.combatants.includes(key)) {
          delete votes[key]
        }
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

    // Check for roles_secretos: Payaso wins if voted
    if (mode === "roles_secretos") {
      const votedPlayer = players.find((p) => p.sessionId === mostVotedSessionId)
      if (votedPlayer?.secretRole === "payaso") {
        // Payaso wins!
        await ctx.db.patch(votedPlayer._id, {
          points: (votedPlayer.points || 0) + 200,
        })
        await ctx.db.patch(args.roomId, {
          status: "results",
          lastActivityAt: Date.now(),
          payasoWinner: mostVotedSessionId,
        })
        return { gameOver: true, payasoWins: true, eliminatedSessionId: mostVotedSessionId }
      }
    }

    // Determine if impostor(s) caught based on mode
    const isImpostor1 = mostVotedSessionId === room.impostorId
    const isImpostor2 = room.impostorId2 && mostVotedSessionId === room.impostorId2
    const impostorCaught = isImpostor1 || isImpostor2

    const impostorPlayer = players.find((p) => p.sessionId === room.impostorId)
    const impostorPlayer2 = room.impostorId2 ? players.find((p) => p.sessionId === room.impostorId2) : undefined

    // Award points
    for (const player of activePlayers) {
      let pointsToAdd = 0

      if (impostorCaught) {
        // Check if voted for an impostor
        const votedForImpostor =
          player.votedFor === room.impostorId ||
          (room.impostorId2 && player.votedFor === room.impostorId2)

        if (votedForImpostor) {
          pointsToAdd += 100
          await ctx.db.patch(player._id, {
            correctVotes: (player.correctVotes || 0) + 1,
          })
        }
      } else {
        // Impostor survived this round
        const isPlayerImpostor = player.sessionId === room.impostorId || player.sessionId === room.impostorId2
        if (isPlayerImpostor) {
          pointsToAdd += 50
        } else if (player.sessionId !== mostVotedSessionId) {
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

    // Eliminate the most voted player
    const eliminatedPlayer = players.find((p) => p.sessionId === mostVotedSessionId)
    if (eliminatedPlayer) {
      await ctx.db.patch(eliminatedPlayer._id, {
        isEliminated: true,
      })
    }

    // For doble_agente and team_vs_team, check if ALL impostors are caught
    if (mode === "doble_agente" || mode === "team_vs_team") {
      const impostor1Eliminated = !activePlayers.some(p => p.sessionId === room.impostorId) ||
                                   mostVotedSessionId === room.impostorId
      const impostor2Eliminated = !room.impostorId2 ||
                                   !activePlayers.some(p => p.sessionId === room.impostorId2) ||
                                   mostVotedSessionId === room.impostorId2

      if (impostor1Eliminated && impostor2Eliminated) {
        // Both impostors caught - players win
        await ctx.db.patch(args.roomId, {
          status: "results",
          lastActivityAt: Date.now(),
        })
        return { gameOver: true, impostorCaught: true, bothImpostorsCaught: true, eliminatedSessionId: mostVotedSessionId }
      }
    } else if (impostorCaught) {
      // Single impostor modes - game ends when impostor caught
      await ctx.db.patch(args.roomId, {
        status: "results",
        lastActivityAt: Date.now(),
      })
      return { gameOver: true, impostorCaught: true, eliminatedSessionId: mostVotedSessionId }
    }

    // Check remaining players
    const remainingActive = activePlayers.filter((p) => p.sessionId !== mostVotedSessionId)

    // Count remaining impostors and non-impostors
    const remainingImpostors = remainingActive.filter((p) =>
      p.sessionId === room.impostorId || p.sessionId === room.impostorId2
    )
    const remainingNonImpostors = remainingActive.filter((p) =>
      p.sessionId !== room.impostorId && p.sessionId !== room.impostorId2
    )

    if (remainingNonImpostors.length <= remainingImpostors.length) {
      // Impostor(s) win - impostors equal or outnumber non-impostors
      if (impostorPlayer && !impostorPlayer.isEliminated) {
        await ctx.db.patch(impostorPlayer._id, {
          points: (impostorPlayer.points || 0) + 150,
          impostorWins: (impostorPlayer.impostorWins || 0) + 1,
        })
      }
      if (impostorPlayer2 && !impostorPlayer2.isEliminated) {
        await ctx.db.patch(impostorPlayer2._id, {
          points: (impostorPlayer2.points || 0) + 150,
          impostorWins: (impostorPlayer2.impostorWins || 0) + 1,
        })
      }

      await ctx.db.patch(args.roomId, {
        status: "results",
        lastActivityAt: Date.now(),
      })
      return { gameOver: true, impostorCaught: false, impostorWins: true, eliminatedSessionId: mostVotedSessionId }
    }

    // Game continues - go back to discussion with remaining players
    const remainingSessionIds = remainingActive.map((p) => p.sessionId)
    const newTurnOrder = shuffleArray(remainingSessionIds)

    // For combate mode, select new combatants
    let newCombatants: string[] | undefined
    if (mode === "combate" && remainingActive.length >= 2) {
      const shuffled = shuffleArray(remainingSessionIds)
      newCombatants = [shuffled[0], shuffled[1]]
    }

    // Reset votes for active players
    for (const player of remainingActive) {
      await ctx.db.patch(player._id, {
        votedFor: undefined,
        secondVote: undefined,
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
      combatants: newCombatants,
    })

    return { gameOver: false, eliminatedSessionId: mostVotedSessionId, continuingWithPlayers: remainingActive.length }
  },
})

// Detective investigates a player (roles_secretos mode)
export const detectiveInvestigate = mutation({
  args: {
    roomId: v.id("rooms"),
    detectiveSessionId: v.string(),
    targetSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.gameMode !== "roles_secretos") throw new Error("Esta habilidad solo está disponible en modo Roles Secretos")

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    const detective = players.find((p) => p.sessionId === args.detectiveSessionId)
    if (!detective) throw new Error("Jugador no encontrado")
    if (detective.secretRole !== "detective") throw new Error("No eres el Detective")
    if (detective.hasUsedAbility) throw new Error("Ya has usado tu habilidad")

    // Mark ability as used
    await ctx.db.patch(detective._id, {
      hasUsedAbility: true,
    })

    // Check if target is an impostor
    const isImpostor = args.targetSessionId === room.impostorId || args.targetSessionId === room.impostorId2

    return { isImpostor }
  },
})

// Fiscal calls early vote (roles_secretos mode)
export const fiscalCallVote = mutation({
  args: {
    roomId: v.id("rooms"),
    fiscalSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.gameMode !== "roles_secretos") throw new Error("Esta habilidad solo está disponible en modo Roles Secretos")
    if (room.status !== "playing") throw new Error("Solo se puede usar durante la discusión")

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    const fiscal = players.find((p) => p.sessionId === args.fiscalSessionId)
    if (!fiscal) throw new Error("Jugador no encontrado")
    if (fiscal.secretRole !== "fiscal") throw new Error("No eres el Fiscal")
    if (fiscal.hasUsedAbility) throw new Error("Ya has usado tu habilidad")

    // Mark ability as used
    await ctx.db.patch(fiscal._id, {
      hasUsedAbility: true,
    })

    // Start voting immediately
    const votingEndTime = Date.now() + 30 * 1000
    await ctx.db.patch(args.roomId, {
      status: "voting",
      votingEndTime,
      lastActivityAt: Date.now(),
    })

    return { votingStarted: true }
  },
})

// Ghost leaves a clue when eliminated (roles_secretos mode)
export const setGhostClue = mutation({
  args: {
    roomId: v.id("rooms"),
    ghostSessionId: v.string(),
    clue: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.gameMode !== "roles_secretos") throw new Error("Esta habilidad solo está disponible en modo Roles Secretos")

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    const ghost = players.find((p) => p.sessionId === args.ghostSessionId)
    if (!ghost) throw new Error("Jugador no encontrado")
    if (ghost.secretRole !== "fantasma") throw new Error("No eres el Fantasma")
    if (!ghost.isEliminated) throw new Error("Solo puedes dejar pista cuando seas eliminado")
    if (ghost.ghostClue) throw new Error("Ya has dejado una pista")

    // Limit clue length
    const clue = args.clue.slice(0, 100)

    await ctx.db.patch(ghost._id, {
      ghostClue: clue,
    })

    return { clueSet: true }
  },
})

// Send emoji (silencio mode)
export const sendEmoji = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.gameMode !== "silencio") throw new Error("Los emojis solo están disponibles en modo Silencio")
    if (room.status !== "playing") throw new Error("Solo se pueden enviar emojis durante el juego")

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    const player = players.find((p) => p.sessionId === args.sessionId)
    if (!player) throw new Error("Jugador no encontrado")
    if (player.isEliminated) throw new Error("No puedes enviar emojis como espectador")

    // Store emoji as a message
    await ctx.db.insert("messages", {
      roomId: args.roomId,
      senderSessionId: args.sessionId,
      senderName: player.name,
      content: args.emoji,
      timestamp: Date.now(),
      isSpectatorChat: false,
      isEmoji: true,
    })

    return { sent: true }
  },
})

// Get emojis for a room (silencio mode)
export const getEmojis = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("isEmoji"), true))
      .collect()

    return messages.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50)
  },
})
