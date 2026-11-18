function buildGameSessions(entries) {
  const sessions = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const gameId = entry.gameId || "game_unknown";
    const current = sessions.get(gameId);
    if (!current) {
      sessions.set(gameId, {
        session: { gameId, createdAt: entry.timestamp, logCount: 1, successCount: entry.status === "success" ? 1 : 0, lastPlayerName: entry.playerName },
        latestTimestamp: entry.timestamp
      });
      continue;
    }
    current.session.createdAt = Math.min(current.session.createdAt, entry.timestamp);
    current.session.logCount++;
    if (entry.status === "success") current.session.successCount++;
    if (entry.timestamp > current.latestTimestamp) {
      current.latestTimestamp = entry.timestamp;
      current.session.lastPlayerName = entry.playerName;
    }
  }
  return Array.from(sessions.values()).map((current) => current.session).sort((a, b) => b.createdAt - a.createdAt);
}
export {
  buildGameSessions
};
