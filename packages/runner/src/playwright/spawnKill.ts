// timeout 時の段階的 kill 戦略で使う共通定数。
// nodeSpawnFn と dockerSpawnFn の挙動を揃えるために共有する。
export const SIGKILL_GRACE_MS = 5_000;
