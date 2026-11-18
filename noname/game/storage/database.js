import "../../../noname.js";
import { SqliteDatabase } from "../../storage/database.js";
import { sqliteGameOperation } from "../../storage/gameStorage.js";
import { game } from "../index.js";
import { lib } from "../../library/index.js";
import { _status } from "../../status/index.js";
const databaseMethods = {
  putDB(storeName, idbValidKey, value, onSuccess, onError) {
    const database = lib.db;
    if (database instanceof SqliteDatabase) return sqliteGameOperation(database, "put", storeName, idbValidKey, value, onSuccess, onError, { lib, game, status: _status });
    if (!database) {
      return Promise.resolve(value);
    }
    if (lib.status.reload) {
      return new Promise(
        (resolve, reject) => lib[_status.dburgent ? "ondb2" : "ondb"].push([
          "putDB",
          [
            storeName,
            idbValidKey,
            value,
            (event) => {
              if (typeof onSuccess == "function") {
                try {
                  onSuccess(event);
                } catch (e) {
                  console.error("[putDB] queued onSuccess threw:", e);
                }
              }
              resolve(event);
            },
            (event) => {
              if (typeof onError == "function") {
                try {
                  onError(event);
                } catch (e) {
                  console.error("[putDB] queued onError threw:", e);
                }
                resolve();
              } else {
                reject(event);
              }
            }
          ]
        ])
      );
    }
    lib.status.reload++;
    return new Promise((resolve, reject) => {
      const record = database.transaction([storeName], "readwrite").objectStore(storeName).put(structuredClone(value), idbValidKey);
      record.onerror = (event) => {
        if (typeof onError == "function") {
          try {
            onError(event);
          } catch (e) {
            console.error("[putDB] onError callback threw:", e);
          }
          game.reload2();
          resolve();
        } else {
          game.reload2();
          reject(event);
        }
      };
      record.onsuccess = (event) => {
        if (typeof onSuccess == "function") {
          _status.dburgent = true;
          try {
            onSuccess(event);
          } catch (e) {
            console.error("[putDB] onSuccess callback threw:", e);
          } finally {
            delete _status.dburgent;
          }
        }
        game.reload2();
        resolve(event);
      };
    });
  },
  getDB(storeName, query, onSuccess, onError) {
    const database = lib.db;
    if (database instanceof SqliteDatabase) return sqliteGameOperation(database, "get", storeName, query, void 0, onSuccess, onError, { lib, game, status: _status });
    if (!database) {
      return new Promise((resolve) => {
        if (typeof onSuccess == "function") {
          onSuccess(null);
        }
        resolve(null);
      });
    }
    if (lib.status.reload) {
      return new Promise(
        (resolve, reject) => lib[_status.dburgent ? "ondb2" : "ondb"].push([
          "getDB",
          [
            storeName,
            query,
            (result) => {
              if (typeof onSuccess == "function") {
                try {
                  onSuccess(result);
                } catch (e) {
                  console.error("[getDB] queued onSuccess threw:", e);
                }
              }
              resolve(result);
            },
            (event) => {
              if (typeof onError == "function") {
                try {
                  onError(event);
                } catch (e) {
                  console.error("[getDB] queued onError threw:", e);
                }
                resolve(void 0);
              } else {
                reject(event);
              }
            }
          ]
        ])
      );
    }
    return new Promise(
      query ? (resolve, reject) => {
        lib.status.reload++;
        const idbRequest = database.transaction([storeName], "readwrite").objectStore(storeName).get(query);
        idbRequest.onerror = (event) => {
          if (typeof onError == "function") {
            try {
              onError(event);
            } catch (e) {
              console.error("[getDB] onError callback threw:", e);
            }
            game.reload2();
            resolve(void 0);
          } else {
            game.reload2();
            reject(event);
          }
        };
        idbRequest.onsuccess = () => {
          const result = idbRequest.result;
          if (typeof onSuccess == "function") {
            _status.dburgent = true;
            try {
              onSuccess(result);
            } catch (e) {
              console.error("[getDB] onSuccess callback threw:", e);
            } finally {
              delete _status.dburgent;
            }
          }
          game.reload2();
          resolve(result);
        };
      } : (resolve, reject) => {
        lib.status.reload++;
        const idbRequest = database.transaction([storeName], "readwrite").objectStore(storeName).openCursor();
        const object = {};
        idbRequest.onerror = (event) => {
          if (typeof onError == "function") {
            try {
              onError(event);
            } catch (e) {
              console.error("[getDB] onError callback threw:", e);
            }
            game.reload2();
            resolve(void 0);
          } else {
            game.reload2();
            reject(event);
          }
        };
        idbRequest.onsuccess = () => {
          const result = idbRequest.result;
          if (result) {
            if (typeof result != "object" || !("key" in result) || !("value" in result) || !("continue" in result) || typeof result.continue != "function") {
              throw new TypeError("IndexedDB cursor result is invalid");
            }
            const cursorKey = result.key;
            const key = typeof cursorKey == "symbol" ? cursorKey : String(cursorKey);
            object[key] = result.value;
            result.continue();
            return;
          }
          if (typeof onSuccess == "function") {
            _status.dburgent = true;
            try {
              onSuccess(object);
            } catch (e) {
              console.error("[getDB] onSuccess callback threw:", e);
            } finally {
              delete _status.dburgent;
            }
          }
          game.reload2();
          resolve(object);
        };
      }
    );
  },
  deleteDB(storeName, query, onSuccess, onError) {
    const database = lib.db;
    if (database instanceof SqliteDatabase) return sqliteGameOperation(database, "delete", storeName, query, void 0, onSuccess, onError, { lib, game, status: _status });
    if (!database) {
      return new Promise((resolve) => {
        if (typeof onSuccess == "function") {
          onSuccess(false);
        }
        resolve(false);
      });
    }
    if (lib.status.reload) {
      return new Promise(
        (resolve, reject) => lib[_status.dburgent ? "ondb2" : "ondb"].push([
          "deleteDB",
          [
            storeName,
            query,
            (event) => {
              if (typeof onSuccess == "function") {
                try {
                  onSuccess(event);
                } catch (e) {
                  console.error("[deleteDB] queued onSuccess threw:", e);
                }
              }
              resolve(event);
            },
            (event) => {
              if (typeof onError == "function") {
                try {
                  onError(event);
                } catch (e) {
                  console.error("[deleteDB] queued onError threw:", e);
                }
                resolve();
              } else {
                reject(event);
              }
            }
          ]
        ])
      );
    }
    return query ? new Promise((resolve, reject) => {
      lib.status.reload++;
      const record = database.transaction([storeName], "readwrite").objectStore(storeName).delete(query);
      record.onerror = (event) => {
        if (typeof onError == "function") {
          try {
            onError(event);
          } catch (e) {
            console.error("[deleteDB] onError callback threw:", e);
          }
          game.reload2();
          resolve();
        } else {
          game.reload2();
          reject(event);
        }
      };
      record.onsuccess = (event) => {
        if (typeof onSuccess == "function") {
          try {
            onSuccess(event);
          } catch (e) {
            console.error("[deleteDB] onSuccess callback threw:", e);
          }
        }
        game.reload2();
        resolve(event);
      };
    }) : game.getDB(storeName).then((object) => {
      if (object === null || object === void 0) {
        throw new TypeError("Cannot convert undefined or null to object");
      }
      const keys = Object.keys(object);
      lib.status.reload += keys.length;
      const store = database.transaction([storeName], "readwrite").objectStore(storeName);
      return Promise.allSettled(
        keys.map(
          (key) => new Promise((resolve, reject) => {
            const request = store.delete(key);
            request.onerror = (event) => {
              game.reload2();
              reject(event);
            };
            request.onsuccess = (event) => {
              game.reload2();
              resolve(event);
            };
          })
        )
      );
    });
  }
};
export {
  databaseMethods
};
