#!/usr/bin/env node
// Verifies the role gate (authorize/adminOnly/officeBearerOrAdmin) on every
// route that restricts access by role, against a running instance seeded
// with the fixture users from test/fixtures.js. This does not exercise
// societyAccess-guarded routes: those gate by resource ownership rather than
// role, so "allowed"/"blocked" isn't a fixed per-role expectation the way it
// is for a plain role check.
const { TEST_USERS } = require('../test/fixtures');

const args = process.argv.slice(2);
const baseUrlArg = args.find((arg) => arg.startsWith('--baseUrl='));
const BASE_URL = baseUrlArg ? baseUrlArg.split('=')[1] : 'http://localhost:5000';
const API = `${BASE_URL}/api/v1`;

const DUMMY_ID = '507f1f77bcf86cd799439011';

// Each entry: an endpoint guarded by a role check, and which roles the
// middleware allows through.
const MATRIX = [
    { method: 'GET', path: '/dashboard', allowedRoles: ['ADMIN'] },
    { method: 'GET', path: '/users', allowedRoles: ['ADMIN'] },
    { method: 'GET', path: `/users/${DUMMY_ID}`, allowedRoles: ['ADMIN'] },
    { method: 'GET', path: '/transactions', allowedRoles: ['ADMIN'] },
    { method: 'GET', path: `/transactions/${DUMMY_ID}`, allowedRoles: ['ADMIN', 'OFFICE_BEARER'] },
    { method: 'PATCH', path: `/societies/${DUMMY_ID}/budget`, allowedRoles: ['ADMIN'] },
    { method: 'POST', path: '/announcements', allowedRoles: ['ADMIN', 'OFFICE_BEARER'] },
    { method: 'DELETE', path: `/announcements/${DUMMY_ID}`, allowedRoles: ['ADMIN', 'OFFICE_BEARER'] },
    { method: 'PATCH', path: '/institution/logo', allowedRoles: ['ADMIN'] },
];

async function login(email, password) {
    const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        throw new Error(`Login failed for ${email}: ${res.status}`);
    }
    const body = await res.json();
    return body.token;
}

async function request(method, path, token) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API}${path}`, { method, headers });
    return res.status;
}

async function main() {
    const tokens = {
        ADMIN: await login(TEST_USERS.admin.email, TEST_USERS.admin.password),
        OFFICE_BEARER: await login(TEST_USERS.officeBearer.email, TEST_USERS.officeBearer.password),
    };

    let failures = 0;

    for (const { method, path, allowedRoles } of MATRIX) {
        // Unauthenticated requests must always be rejected.
        const anonStatus = await request(method, path, null);
        if (anonStatus !== 401) {
            failures += 1;
            console.error(`FAIL  ${method} ${path} (no token): expected 401, got ${anonStatus}`);
        } else {
            console.log(`pass  ${method} ${path} (no token): 401`);
        }

        for (const role of ['ADMIN', 'OFFICE_BEARER']) {
            const status = await request(method, path, tokens[role]);
            const isAllowed = allowedRoles.includes(role);

            if (isAllowed) {
                // Should clear the role gate - any response other than 401/403
                // means the request reached the handler.
                if (status === 401 || status === 403) {
                    failures += 1;
                    console.error(`FAIL  ${method} ${path} (${role}): expected to pass the role gate, got ${status}`);
                } else {
                    console.log(`pass  ${method} ${path} (${role}): ${status} (gate passed)`);
                }
            } else if (status !== 403) {
                failures += 1;
                console.error(`FAIL  ${method} ${path} (${role}): expected 403, got ${status}`);
            } else {
                console.log(`pass  ${method} ${path} (${role}): 403`);
            }
        }
    }

    if (failures > 0) {
        console.error(`\n${failures} RBAC matrix check(s) failed.`);
        process.exit(1);
    }

    console.log(`\nAll RBAC matrix checks passed (${MATRIX.length} routes).`);
}

main().catch((err) => {
    console.error('RBAC matrix script crashed:', err);
    process.exit(1);
});
