export {};

declare module "@/library/cache/cacheContext.js" {
	interface CacheContext {
		lib: Library;
		game: Game;
		get: Get;
	}
}
