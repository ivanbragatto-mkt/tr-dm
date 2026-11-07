import assert from "node:assert/strict";
import { fetchFollow, usesFollowCheck } from "../src/lib/engine/follow";
import { buildGraph } from "../src/lib/flow";

const ok = (j: unknown, status = 200) => (async () => new Response(JSON.stringify(j), { status })) as unknown as typeof fetch;
assert.deepEqual(await fetchFollow("t", "123", ok({ is_user_follow_business: true, follower_count: 42 })), { follows: true, followers: 42, note: undefined });
assert.equal((await fetchFollow("t", "123", ok({ is_user_follow_business: false }))).follows, false);
const missing = await fetchFollow("t", "123", ok({ follower_count: 5 }));
assert.equal(missing.follows, null);
const err = await fetchFollow("t", "123", ok({ error: { code: 100, message: "nope" } }, 400));
assert.equal(err.follows, null);
assert.match(err.note ?? "", /100/);
const boom = await fetchFollow("t", "123", (async () => { throw new Error("net"); }) as unknown as typeof fetch);
assert.equal(boom.follows, null);

const g = (requireFollow: boolean) => buildGraph({ postScope: "all", postId: null, anyWord: true, keywords: [], publicReply: false, publicReplies: [], dm: { text: { "pt-BR": "x" }, button: {} }, pdf: null, tag: "", requireFollow });
assert.equal(usesFollowCheck(g(true)), true);
assert.equal(usesFollowCheck(g(false)), false);
console.log("follow: ok");
