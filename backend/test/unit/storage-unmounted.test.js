// AUD-001 containment: the storage router has no authentication or
// authorization, so it must not be reachable through the application route
// index until an approved access policy is implemented.
//
// These tests inspect the real route index's layer stack statically. They do
// not dispatch requests (so no storage code can run), start a server, or touch
// a database. They verify mounting only; HTTP-level unavailability still needs
// an isolated HTTP check.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const router = require("../../src/routes");

const STORAGE_PATHS = [
  "/storage",
  "/storage/",
  "/storage/upload",
  "/storage/files",
  "/storage/download/some-blob",
  "/storage/some-blob",
];

// Layers created by `router.use(path, ...)` that would handle `path`.
// Root-mounted layers (`router.use("/", ...)`) match everything and are
// inspected separately below.
function pathMountedLayers(path) {
  return router.stack.filter(
    (layer) => !layer.route && !layer.regexp.fast_slash && layer.regexp.test(path),
  );
}

// Every route path declared inside routers mounted at the root, plus any
// route declared directly on the index router.
function rootLevelRoutePaths() {
  const paths = [];
  for (const layer of router.stack) {
    if (layer.route) {
      paths.push(layer.route.path);
    } else if (layer.regexp.fast_slash && layer.handle && layer.handle.stack) {
      for (const inner of layer.handle.stack) {
        if (inner.route) paths.push(inner.route.path);
      }
    }
  }
  return paths;
}

test("route index loads and exposes a layer stack to inspect", () => {
  assert.ok(Array.isArray(router.stack));
  assert.ok(router.stack.length > 0);
});

test("AUD-001: no router is mounted at any /storage path", () => {
  for (const path of STORAGE_PATHS) {
    assert.equal(
      pathMountedLayers(path).length,
      0,
      `a router is mounted for ${path}`,
    );
  }
});

test("AUD-001: no root-mounted router or index route declares a /storage path", () => {
  const offending = rootLevelRoutePaths().filter(
    (p) => typeof p === "string" && /^\/storage(\/|$)/.test(p),
  );

  assert.deepEqual(offending, []);
});

test("route index still mounts the other routers (containment removed only storage)", () => {
  for (const path of [
    "/auth/login",
    "/users",
    "/societies",
    "/transactions",
    "/events",
    "/projects",
    "/announcements",
    "/channels",
  ]) {
    assert.ok(
      pathMountedLayers(path).length > 0,
      `expected a router mounted for ${path}`,
    );
  }
});

test("health route is still declared on the index router", () => {
  assert.ok(rootLevelRoutePaths().includes("/health"));
});
