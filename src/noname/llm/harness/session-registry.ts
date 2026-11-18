import { SeatSession } from "./seat-session.js";

/** 管理当前客户端生命周期内的座位会话集合。 */
export class SessionRegistry {
	private readonly sessions = new Map<string, SeatSession>();

	static buildKey(gameId: string, seatNum: number): string {
		const cleanGame = gameId || "game_unknown";
		const cleanSeat = Number.isFinite(seatNum) && seatNum > 0 ? Math.floor(seatNum) : 0;
		return `${cleanGame}:seat_${cleanSeat}`;
	}

	getOrCreate(gameId: string, seatNum: number, backendFingerprint: string): SeatSession {
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

	get(sessionKey: string): SeatSession | undefined {
		return this.sessions.get(sessionKey);
	}

	delete(sessionKey: string): void {
		this.sessions.delete(sessionKey);
	}

	resetGame(gameId?: string): void {
		if (!gameId) {
			this.sessions.clear();
			return;
		}
		const prefix = `${gameId}:`;
		for (const key of Array.from(this.sessions.keys())) {
			if (key.startsWith(prefix)) this.sessions.delete(key);
		}
	}

	clear(): void {
		this.sessions.clear();
	}
}

export const seatSessionRegistry = new SessionRegistry();
