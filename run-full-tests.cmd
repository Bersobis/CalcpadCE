@echo off
cd /d D:\croos\CalcpadCE
set PATH=C:\Users\Admin\dotnet-sdk113;%PATH%
set DOTNET_ROOT=C:\Users\Admin\dotnet-sdk113
dotnet test Calcpad.Tests\Calcpad.Tests.csproj --nologo -v q > full-test.log 2>&1
echo EXIT=%ERRORLEVEL% >> full-test.log
