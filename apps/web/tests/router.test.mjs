import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRoute } from "../src/js/router.js";

const routes = [
  { path: "/", name: "home" },
  { path: "/results", name: "results" },
  { path: "/app/*", name: "app" },
  { path: "/x/:id", name: "param" },
];

test("matches exact and trailing-slash paths", () => {
  assert.equal(matchRoute(routes, "/").route.name, "home");
  assert.equal(matchRoute(routes, "/results").route.name, "results");
  assert.equal(matchRoute(routes, "/results/").route.name, "results");
});

test("wildcard captures the rest for the app shell", () => {
  assert.deepEqual(matchRoute(routes, "/app").params, { rest: "" });
  assert.deepEqual(matchRoute(routes, "/app/queue").params, { rest: "queue" });
  assert.deepEqual(matchRoute(routes, "/app/nudges/abc").params, { rest: "nudges/abc" });
});

test("named params decode", () => {
  assert.deepEqual(matchRoute(routes, "/x/a%20b").params, { id: "a b" });
});

test("unknown path returns null (404)", () => {
  assert.equal(matchRoute(routes, "/nope"), null);
  assert.equal(matchRoute(routes, "/x"), null);
});
