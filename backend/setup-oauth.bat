@echo off
REM K-TRASH Google OAuth Setup Script for Windows
REM Automated setup helper for development environment

setlocal enabledelayedexpansion

echo.
echo 🚀 K-TRASH Google OAuth Setup Script (Windows)
echo =============================================
echo.

REM Check Node.js
echo ⏳ Checking prerequisites...
node -v >nul 2>&1
if errorlevel 1 (
    echo ✗ Node.js not found. Please install Node.js v14 or higher.
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
    echo ✓ Node.js detected: %NODE_VERSION%
)

REM Check npm
npm -v >nul 2>&1
if errorlevel 1 (
    echo ✗ npm not found.
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
    echo ✓ npm detected: v%NPM_VERSION%
)

REM Install Backend Dependencies
echo.
echo ⏳ Installing backend dependencies...
cd K-TRASHPBL\backend

if not exist node_modules (
    call npm install
    if errorlevel 1 (
        echo ✗ Failed to install backend dependencies
        exit /b 1
    )
    echo ✓ Backend dependencies installed
) else (
    echo ⚠ node_modules already exists in backend
)

REM Check google-auth-library
npm list google-auth-library >nul 2>&1
if errorlevel 1 (
    echo ⏳ Installing google-auth-library...
    call npm install google-auth-library
)
echo ✓ google-auth-library found

REM Install Frontend Dependencies
echo.
echo ⏳ Installing frontend dependencies...
cd ..\pundesari

if not exist node_modules (
    call npm install
    if errorlevel 1 (
        echo ✗ Failed to install frontend dependencies
        exit /b 1
    )
    echo ✓ Frontend dependencies installed
) else (
    echo ⚠ node_modules already exists in frontend
)

REM Check environment files
echo.
echo ⏳ Checking environment files...

if exist "..\backend\.env" (
    echo ✓ Backend .env found
) else (
    echo ✗ Backend .env not found
)

if exist ".env" (
    echo ✓ Frontend .env found
) else (
    echo ✗ Frontend .env not found
)

REM Summary
echo.
echo ✓ Setup Complete!
echo.
echo 📝 Next steps:
echo.
echo 1️⃣  Database Migration:
echo    mysql -u root -p bank_sampah ^< ..\backend\google_oauth_migration.sql
echo.
echo 2️⃣  Update Google Cloud Console:
echo    - Add http://localhost:3000 to Authorized Origins
echo    - Add http://localhost:3000 to Authorized Redirect URIs
echo    - Copy Client ID to GOOGLE_CLIENT_ID in .env files
echo.
echo 3️⃣  Start Backend (Terminal 1):
echo    cd K-TRASHPBL\backend
echo    npm run dev
echo.
echo 4️⃣  Start Frontend (Terminal 2):
echo    cd K-TRASHPBL\pundesari
echo    npm start
echo.
echo 5️⃣  Test Google Login:
echo    - Open http://localhost:3000
echo    - Click Login
echo    - Click Google Login button
echo    - Select your Google account
echo.
echo 📖 Full guide: type ..\GOOGLE_OAUTH_IMPLEMENTATION_GUIDE.md
echo.

pause
