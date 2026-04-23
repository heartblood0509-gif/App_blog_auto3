@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM =====================================================
REM BlogPublisher Windows 자동 빌드 스크립트
REM 사용법: 이 파일을 더블클릭하면 자동 실행됨
REM =====================================================

echo.
echo ========================================================
echo    BlogPublisher Windows 빌드 시작
echo ========================================================
echo.

REM 현재 스크립트 위치로 이동
cd /d "%~dp0"

REM -----------------------------------------------------
REM 사전 점검: Python, Node.js, Git 설치 확인
REM -----------------------------------------------------
echo [1/6] 사전 도구 점검 중...

where python >nul 2>&1
if errorlevel 1 (
    echo [오류] Python이 설치되지 않았거나 PATH에 없습니다.
    echo        WINDOWS_BUILD_GUIDE.md 를 참고해 Python을 먼저 설치하세요.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo [오류] Node.js가 설치되지 않았습니다.
    echo        https://nodejs.org 에서 LTS 버전을 설치하세요.
    pause
    exit /b 1
)

echo   ✓ Python 발견
echo   ✓ Node.js 발견

REM -----------------------------------------------------
REM Frontend 빌드 (Next.js standalone)
REM -----------------------------------------------------
echo.
echo [2/6] Frontend 의존성 설치...
cd frontend
if not exist node_modules (
    call npm install
    if errorlevel 1 (
        echo [오류] Frontend npm install 실패
        pause
        exit /b 1
    )
) else (
    echo   ✓ node_modules 이미 존재 (스킵)
)

echo.
echo [3/6] Frontend 빌드 중 (Next.js)...
call npm run build
if errorlevel 1 (
    echo [오류] Next.js 빌드 실패
    pause
    exit /b 1
)
echo   ✓ Frontend 빌드 완료

REM -----------------------------------------------------
REM Publisher (Python 서버) 빌드
REM -----------------------------------------------------
echo.
echo [4/6] Python 의존성 설치 + PyInstaller 빌드...
cd ..\publisher

REM pip 의존성 설치
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [오류] Python 의존성 설치 실패
    pause
    exit /b 1
)

REM PyInstaller 설치 (없으면)
python -m pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    python -m pip install pyinstaller
)

REM Playwright Chromium 설치
echo.
echo   Playwright Chromium 다운로드 (최초 1회, 3~5분 소요)...
python -m playwright install chromium
if errorlevel 1 (
    echo [경고] Playwright chromium 설치 실패. 수동으로 다시 시도:
    echo        python -m playwright install chromium
)

REM PyInstaller 빌드
echo.
echo   PyInstaller로 Python 바이너리 생성 중 (2~5분 소요)...
python -m PyInstaller BlogPublisher.spec --clean --noconfirm
if errorlevel 1 (
    echo [오류] PyInstaller 빌드 실패
    pause
    exit /b 1
)
echo   ✓ Python 바이너리 완성: publisher\dist\BlogPublisher.exe

REM -----------------------------------------------------
REM Electron 빌드 (.exe 설치 파일)
REM -----------------------------------------------------
echo.
echo [5/6] Electron 의존성 설치...
cd ..\electron
if not exist node_modules (
    call npm install
    if errorlevel 1 (
        echo [오류] Electron npm install 실패
        pause
        exit /b 1
    )
) else (
    echo   ✓ node_modules 이미 존재 (스킵)
)

echo.
echo [6/6] Electron Windows 설치 파일 빌드 중...
call npx tsc
if errorlevel 1 (
    echo [오류] TypeScript 컴파일 실패
    pause
    exit /b 1
)

call npx electron-builder --win
if errorlevel 1 (
    echo [오류] electron-builder 실패
    pause
    exit /b 1
)

REM -----------------------------------------------------
REM 완료
REM -----------------------------------------------------
echo.
echo ========================================================
echo    ✅ 빌드 완료!
echo ========================================================
echo.
echo    📦 결과물 위치:
echo       %~dp0release\BlogPublisher-Setup-1.0.0.exe
echo.
echo    다음 단계:
echo    1. 위 .exe 파일을 더블클릭하여 설치 테스트
echo    2. 설치 후 BlogPublisher 앱 실행
echo    3. Gemini API 키 입력, 네이버 계정 등록
echo    4. 블로그 생성 + 발행 테스트
echo.
pause
endlocal
