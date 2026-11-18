import { createNamePrefixOrigins } from "./origins.js";
import { createNamePrefixEditions } from "./editions.js";
import { createNamePrefixStyles } from "./styles.js";
import { createNamePrefixCharacters } from "./characters.js";
function createNamePrefix() {
  return new Map([...createNamePrefixOrigins(), ...createNamePrefixEditions(), ...createNamePrefixStyles(), ...createNamePrefixCharacters()]);
}
export {
  createNamePrefix
};
