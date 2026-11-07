import assert from "node:assert/strict";
import { buildSeries, dayRange, sumSeries } from "../src/lib/stats";

const days = dayRange(5, new Date("2026-11-07T10:00:00Z"));
assert.deepEqual(days, ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]);

const row = (day: string, followers: number | null, reach: number | null = null) => ({ day, followers, reach, interactions: null, likes: null, comments: null, profile_views: null });
const a = buildSeries(days, [row("2026-11-05", 100, 7), row("2026-11-07", 110)], [{ day: "2026-11-06", triggers: 3, messages_out: 2, messages_in: 4, new_contacts: 1 }]);
// before the first known day: no fake jump (uses the earliest known value); gaps carry the last value forward
assert.deepEqual(a.followers, [100, 100, 100, 100, 110]);
assert.deepEqual(a.reach, [null, null, 7, null, null]);
assert.deepEqual(a.triggers, [0, 0, 0, 3, 0]);

const b = buildSeries(days, [row("2026-11-07", 50)], []);
const t = sumSeries([a, b], 5);
assert.deepEqual(t.followers, [150, 150, 150, 150, 160]);
assert.deepEqual(t.reach, [null, null, 7, null, null]); // null only when nobody knows
assert.deepEqual(t.triggers, [0, 0, 0, 3, 0]);
console.log("stats: ok");
