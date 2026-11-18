import { showStorageFailure } from "./transport.js";
async function sqliteGameOperation(database, action, store, key, value, onSuccess, onError, context) {
  const { lib, game, status } = context;
  lib.status.reload++;
  try {
    let result;
    while (true) {
      try {
        if (action === "get") result = key == null ? Object.fromEntries((await database.entries(store)).map((row) => [String(row.key), row.value])) : await database.get(store, key);
        else if (action === "put") result = await database.put(store, value, key ?? void 0);
        else result = await database.delete(store, key ?? void 0);
        break;
      } catch (error) {
        try {
          onError?.(error);
        } catch (callbackError) {
          console.error(callbackError);
        }
        await showStorageFailure(error instanceof Error ? error : new Error(String(error)));
      }
    }
    if (action !== "get") {
      const event = new Event("success");
      Object.defineProperty(event, "target", { value: { result } });
      result = event;
    }
    status.dburgent = true;
    try {
      onSuccess?.(result);
    } catch (error) {
      console.error(`[${action}DB] callback threw`, error);
    } finally {
      delete status.dburgent;
    }
    return result;
  } finally {
    game.reload2();
  }
}
export {
  sqliteGameOperation
};
