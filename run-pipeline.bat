@echo off
set PATH=%LOCALAPPDATA%\node-portable\node-v20.20.2-win-x64;%PATH%
cd /d "c:\Users\adam\Desktop\New folder\licence-generator-"
echo === PIPELINE START %date% %time% === >> pipeline.log
node -v >> pipeline.log 2>&1
echo === INSTALL START %time% === >> pipeline.log
call npm install --prefer-offline --legacy-peer-deps --ignore-scripts --no-fund --no-audit --no-progress --maxsockets 3 >> pipeline.log 2>&1
echo === INSTALL EXIT %errorlevel% %time% === >> pipeline.log
echo === TYPECHECK START %time% === >> pipeline.log
call node node_modules\typescript\bin\tsc --noEmit >> pipeline.log 2>&1
echo === TYPECHECK EXIT %errorlevel% %time% === >> pipeline.log
echo === PIPELINE END %time% === >> pipeline.log
