const SURF_AVATAR_EMOJIS = [
  "🏄",
  "🏄🏻",
  "🏄🏼",
  "🏄🏽",
  "🏄🏾",
  "🏄🏿",
  "🏄‍♀️",
  "🏄🏻‍♀️",
  "🏄🏼‍♀️",
  "🏄🏽‍♀️",
  "🏄🏾‍♀️",
  "🏄🏿‍♀️",
  "🏄‍♂️",
  "🏄🏻‍♂️",
  "🏄🏼‍♂️",
  "🏄🏽‍♂️",
  "🏄🏾‍♂️",
  "🏄🏿‍♂️",
] as const;

function hashSeed(seed: string) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function pickSurfAvatarEmoji(seed?: string | number | null) {
  const normalizedSeed = String(seed ?? "surfer");
  const index = hashSeed(normalizedSeed) % SURF_AVATAR_EMOJIS.length;
  return SURF_AVATAR_EMOJIS[index];
}
