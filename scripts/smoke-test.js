"use strict";
const assert = require("node:assert/strict");

const base = (process.env.BASE_URL || "http://127.0.0.1:3187").replace(/\/$/, "");

async function run() {
  const health = await fetch(base + "/api/health");
  assert.equal(health.status, 200, "health endpoint must return HTTP 200");
  const healthBody = await health.json();
  assert.equal(healthBody.ok, true);
  assert.equal(healthBody.database, "SQLite");

  for (const route of ["/api/public/announcements", "/api/public/events"]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route + " must be public");
    const body = await response.json();
    assert.ok(Array.isArray(body.announcements || body.events));
  }

  const denied = await fetch(base + "/api/members");
  assert.equal(denied.status, 401, "member directory must require authentication");

  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: process.env.TEST_ADMIN_USERNAME || "admin",
      password: process.env.TEST_ADMIN_PASSWORD || "LAS-CI-Test-Password-2026!"
    })
  });
  assert.equal(login.status, 200, "administrator login must succeed");
  const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
  assert.match(cookie, /^las_session=/, "login must issue a session cookie");

  const me = await fetch(base + "/api/auth/me", { headers: { cookie } });
  assert.equal(me.status, 200);
  const meBody = await me.json();
  assert.equal(meBody.user.role, "admin");

  const members = await fetch(base + "/api/members", { headers: { cookie } });
  assert.equal(members.status, 200, "authenticated member directory must load");
  const memberBody = await members.json();
  assert.ok(Array.isArray(memberBody.members));
  if (memberBody.members.length) {
    const first = memberBody.members[0];
    assert.ok(first.name);
    assert.ok(first.phone);
    assert.ok(Object.hasOwn(first, "photoUrl"));
  }

  const logout = await fetch(base + "/api/auth/logout", {
    method: "POST",
    headers: { cookie }
  });
  assert.equal(logout.status, 200);
  const afterLogout = await fetch(base + "/api/members", { headers: { cookie } });
  assert.equal(afterLogout.status, 401, "logout must invalidate the session");

  process.stdout.write("ASBL-LAS smoke tests passed: health, public pages, login, protected directory, logout.\\n");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
