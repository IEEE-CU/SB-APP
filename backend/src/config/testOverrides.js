/**
 * Test-only rate-limit relaxation (AUD-012B).
 *
 * The access-check limiter allows 100 requests per minute everywhere. The isolated test
 * harness and the CI test server make many such calls and need more headroom, so they -
 * and only they - call enableTestRateLimits() in their own process BEFORE loading the
 * application. This is deliberately not an environment variable: an environment can be
 * misconfigured in production (NODE_ENV=test or development was enough before), but another
 * process cannot call a function inside this one. Calling it with NODE_ENV=production throws.
 */

const ACCESS_CHECK_LIMIT_PER_MINUTE = 100;
const TEST_ACCESS_CHECK_LIMIT_PER_MINUTE = 1000;

let relaxed = false;

function enableTestRateLimits(env = process.env) {
  if (env.NODE_ENV === "production") {
    throw new Error("Relaxed test rate limits cannot be enabled when NODE_ENV=production");
  }
  relaxed = true;
}

function accessCheckLimit() {
  return relaxed ? TEST_ACCESS_CHECK_LIMIT_PER_MINUTE : ACCESS_CHECK_LIMIT_PER_MINUTE;
}

/** For tests of this module only. */
function resetTestRateLimits() {
  relaxed = false;
}

module.exports = {
  ACCESS_CHECK_LIMIT_PER_MINUTE,
  TEST_ACCESS_CHECK_LIMIT_PER_MINUTE,
  enableTestRateLimits,
  accessCheckLimit,
  resetTestRateLimits,
};
