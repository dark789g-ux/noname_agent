import type { LLMLogInstanceLease } from "./logger-store.js";

export interface LLMLogLeaseStore {
	putLease(lease: LLMLogInstanceLease): Promise<void>;
	deleteLease(instanceId: string): Promise<void>;
	clearExpiredLeases?(now?: number): Promise<number>;
}

export interface LLMLogBroadcastChannel {
	onmessage: ((event: MessageEvent<LeaseMessage>) => void) | null;
	postMessage(message: LeaseMessage): void;
	close(): void;
}

export interface LLMLogLeaseOptions {
	store: LLMLogLeaseStore;
	prefix: string;
	instanceId?: string;
	clock?: () => number;
	heartbeatMs?: number;
	leaseMs?: number;
	broadcastChannelFactory?: (name: string) => LLMLogBroadcastChannel | undefined;
	setInterval?: (callback: () => void, ms: number) => ReturnType<typeof globalThis.setInterval>;
	clearInterval?: (id: ReturnType<typeof globalThis.setInterval>) => void;
}

type LeaseMessage =
	| { type: "llm_log_alive_query"; requestId: string; ownerIds: string[] }
	| { type: "llm_log_alive_reply"; requestId: string; ownerId: string };

const HEARTBEAT_MS = 30_000;
const LEASE_MS = 90_000;

function createInstanceId(): string {
	const cryptoApi = globalThis.crypto;
	if (cryptoApi?.randomUUID) return `llm_${cryptoApi.randomUUID()}`;
	return `llm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultBroadcastChannel(name: string): LLMLogBroadcastChannel | undefined {
	const Channel = globalThis.BroadcastChannel;
	return Channel ? (new Channel(name) as LLMLogBroadcastChannel) : undefined;
}

/**
 * Owns one browser-tab lease and answers cross-tab liveness probes. Persistence
 * failures are intentionally swallowed here: callers use the persisted lease as
 * a conservative recovery signal, never as a reason to interrupt gameplay.
 */
export class LLMLogLease {
	readonly instanceId: string;
	private readonly store: LLMLogLeaseStore;
	private readonly clock: () => number;
	private readonly heartbeatMs: number;
	private readonly leaseMs: number;
	private readonly channel?: LLMLogBroadcastChannel;
	private readonly setIntervalFn: NonNullable<LLMLogLeaseOptions["setInterval"]>;
	private readonly clearIntervalFn: NonNullable<LLMLogLeaseOptions["clearInterval"]>;
	private timer?: ReturnType<typeof globalThis.setInterval>;
	private closed = false;
	private readonly pendingAliveChecks = new Map<string, { requested: Set<string>; replies: Set<string>; resolve: (replies: Set<string>) => void; timer: ReturnType<typeof globalThis.setTimeout> }>();

	constructor(options: LLMLogLeaseOptions) {
		this.store = options.store;
		this.instanceId = options.instanceId || createInstanceId();
		this.clock = options.clock || Date.now;
		this.heartbeatMs = options.heartbeatMs || HEARTBEAT_MS;
		this.leaseMs = options.leaseMs || LEASE_MS;
		this.setIntervalFn = options.setInterval || globalThis.setInterval;
		this.clearIntervalFn = options.clearInterval || globalThis.clearInterval;
		this.channel = (options.broadcastChannelFactory || defaultBroadcastChannel)(`llm_log_lease_${options.prefix}`);
		if (this.channel) this.channel.onmessage = event => this.onMessage(event.data);
	}

	async start(): Promise<void> {
		await this.keepAlive();
		if (!this.timer) this.timer = this.setIntervalFn(() => void this.keepAlive(), this.heartbeatMs);
	}

	async keepAlive(): Promise<void> {
		if (this.closed) return;
		const updatedAt = this.clock();
		try {
			await this.store.putLease({ instanceId: this.instanceId, updatedAt, expiresAt: updatedAt + this.leaseMs });
			await this.store.clearExpiredLeases?.(updatedAt);
		} catch (_error) {
			// IndexedDB being unavailable must not break an LLM decision.
		}
	}

	/** Returns owners that replied within timeoutMs; an unavailable channel returns an empty set. */
	confirmAlive(ownerIds: Iterable<string>, timeoutMs = 300): Promise<Set<string>> {
		const requested = Array.from(new Set(ownerIds));
		if (!requested.length || !this.channel || this.closed) return Promise.resolve(new Set());
		const requestId = `${this.instanceId}_${this.clock()}_${Math.random().toString(36).slice(2, 8)}`;
		return new Promise(resolve => {
			const replies = new Set<string>();
			const finish = () => {
				const pending = this.pendingAliveChecks.get(requestId);
				if (!pending) return;
				this.pendingAliveChecks.delete(requestId);
				clearTimeout(pending.timer);
				resolve(replies);
			};
			const timer = setTimeout(finish, timeoutMs);
			this.pendingAliveChecks.set(requestId, { requested: new Set(requested), replies, resolve, timer });
			try {
				this.channel!.postMessage({ type: "llm_log_alive_query", requestId, ownerIds: requested });
			} catch (_error) {
				finish();
			}
		});
	}

	async close(release = true): Promise<void> {
		if (this.closed) return;
		this.closed = true;
		if (this.timer) this.clearIntervalFn(this.timer);
		for (const pending of this.pendingAliveChecks.values()) {
			clearTimeout(pending.timer);
			pending.resolve(pending.replies);
		}
		this.pendingAliveChecks.clear();
		this.channel?.close();
		if (!release) return;
		try {
			await this.store.deleteLease(this.instanceId);
		} catch (_error) {
			// Expiry still makes the lease recoverable if page shutdown interrupts this write.
		}
	}

	private onMessage(message: LeaseMessage): void {
		if (message.type === "llm_log_alive_reply") {
			const pending = this.pendingAliveChecks.get(message.requestId);
			if (pending?.requested.has(message.ownerId)) pending.replies.add(message.ownerId);
			return;
		}
		if (message.ownerIds.includes(this.instanceId)) {
			try {
				this.channel?.postMessage({ type: "llm_log_alive_reply", requestId: message.requestId, ownerId: this.instanceId });
			} catch (_error) {
				// BroadcastChannel is best-effort; recovery also verifies the persisted lease.
			}
		}
	}
}
