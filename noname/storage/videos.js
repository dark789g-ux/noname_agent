import { transaction, SqliteDatabase } from "./database.js";
import { showStorageFailure } from "./transport.js";
async function persistVideo(database, video, removed = []) {
  while (true) {
    try {
      await transaction(database, ["video"], "readwrite", async (operation) => {
        const store = operation.objectStore("video");
        for (const time of removed) await store.delete(time);
        await store.put(video);
      });
      return;
    } catch (error) {
      if (!(database instanceof SqliteDatabase)) throw error;
      await showStorageFailure(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
export {
  persistVideo
};
