export {};

declare global {
	interface WebSocket {
		_nocallback?: boolean;
	}
}

declare module "@/library/element/client.js" {
	interface Client {
		onlineKey?: string | null;
		avatar?: string;
		nickname?: string;
	}
}
