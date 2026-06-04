# Authentication Fix and Root Cause

## Summary

A login failure for a user with a bcrypt hash starting with `$2a$` was caused by the backend login logic only recognizing hashes beginning with `$2b$`.

## Root Cause

In `backend/src/controllers/authController.js`, the login flow did this:

- if stored password started with `$2b$`, then call `bcrypt.compare`
- else compare plain text directly

That means a valid bcrypt hash with prefix `$2a$` was never verified correctly.

## Why `VARCHAR(255)` is not the problem

- bcrypt hashes are normally 60 characters long.
- `VARCHAR(255)` is more than sufficient.
- Therefore the login issue is not due to column length.

## What was fixed

### `backend/src/controllers/authController.js`

1. normalize password input using `String(...).normalize('NFC')` for both register and login.
2. detect any bcrypt hash prefix by checking `startsWith('$2')`.
3. use `bcrypt.compare()` for all bcrypt hashes.
4. preserve backward compatibility for non-hashed legacy passwords.
5. if login succeeds with a non-`$2b$` bcrypt hash, rehash the password with current settings and update the DB.

## Important notes

- The active auth route is `backend/index.js` mounting `newAuthRoutes` at `/api/auth`.
- `newAuthRoutes` currently imports `authController`, not `newAuthController`.
- `newAuthController.js` appears to be unused in the current backend route tree.
- The OTP registration flow stores password hashes in `pending_registrations`, and on verification inserts that hash into `users`.
- That path uses an `UPDATE` for duplicate pending emails, so it does not create duplicate hash records for the same pending email.

## Routes affected

- `POST /api/auth/register`
- `POST /api/auth/register/verify`
- `POST /api/auth/login`

## Recommended follow-up

- Verify the actual stored hash for the failing user is exactly 60 characters and has no leading/trailing whitespace.
- If you want, remove or review `backend/src/controllers/newAuthController.js` if it is truly unused.
- Consider adding a small regression test around login for `$2a$` and `$2b$` hashes.
