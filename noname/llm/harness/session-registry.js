import { SeatSession } from "./seat-session.js";
class SessionRegistry {
  sessions = /* @__PURE__ */ new Map();
  static buildKey(gameId, seatNum) {
    const cleanGame = gameId || "game_unknown";
    const cleanSeat = Number.isFinite(seatNum) && seatNum > 0 ? Math.floor(seatNum) : 0;
    return `${cleanGame}:seat_${cleanSeat}`;
  }
  getOrCreate(gameId, seatNum, backendFingerprint) {
    const key = SessionRegistry.buildKey(gameId, seatNum);
    let session = this.sessions.get(key);
    if (!session) {
      session = new SeatSession(key, backendFingerprint);
      this.sessions.set(key, session);
    } else {
      session.syncBackendFingerprint(backendFingerprint);
    }
    return session;
  }
  get(sessionKey) {
    return this.sessions.get(sessionKey);
  }
  delete(sessionKey) {
    this.sessions.delete(sessionKey);
  }
  resetGame(gameId) {
    if (!gameId) {
      this.sessions.clear();
      return;
    }
    const prefix = `${gameId}:`;
    for (const key of Array.from(this.sessions.keys())) {
      if (key.startsWith(prefix)) this.sessions.delete(key);
    }
  }
  clear() {
    this.sessions.clear();
  }
}
const seatSessionRegistry = new SessionRegistry();
export {
  SessionRegistry,
  seatSessionRegistry
};
