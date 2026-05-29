@echo off
REM ============================================================================
REM Publish @testhide/reporters to npm.
REM Reads tokens/env from .env.local (gitignored). Copy .env.local.example first.
REM Usage:  publish.bat
REM ============================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

if not exist ".env.local" (
  echo [publish] ERROR: .env.local not found.
  echo [publish] Copy .env.local.example to .env.local and add your npm token.
  exit /b 1
)

for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env.local") do set "%%a=%%b"

if "%NPM_TOKEN%"=="" (
  echo [publish] ERROR: NPM_TOKEN is not set in .env.local
  exit /b 1
)

echo [publish] Installing...
call npm install || exit /b 1

echo [publish] Test (reporter + conformance gate)...
call npm test || exit /b 1

echo [publish] Writing temporary .npmrc...
> .npmrc echo //registry.npmjs.org/:_authToken=%NPM_TOKEN%

echo [publish] Publishing (public scoped package)...
call npm publish --access public
set "PUB_RC=!errorlevel!"
del .npmrc
if not "!PUB_RC!"=="0" (
  echo [publish] npm publish failed with code !PUB_RC!.
  exit /b !PUB_RC!
)

echo [publish] Done.
endlocal
