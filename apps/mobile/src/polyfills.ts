import * as Crypto from "expo-crypto";

if (!global.crypto?.randomUUID) {
  global.crypto = {
    ...(global.crypto || {}),
    // @ts-expect-error – expo-crypto returns `string`; @readlater/core only needs a string UUID
    randomUUID: () => Crypto.randomUUID(),
  };
}
