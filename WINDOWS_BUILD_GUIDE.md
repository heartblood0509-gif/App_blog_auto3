# Windows PC에서 BlogPublisher 빌드하는 방법

Mac에서 만든 앱을 Windows 버전으로도 배포하려면, **Windows PC에서 직접 빌드**해야 합니다.
이 가이드를 따라하면 약 **30~60분** 안에 `BlogPublisher-Setup-1.0.0.exe` 설치 파일을 만들 수 있습니다.

---

## 📋 전체 흐름 (5단계)

```
1. 필수 도구 3개 설치 (Python, Node.js, Git)  ← 15~20분 (처음 한 번만)
2. 코드 내려받기                              ← 3분
3. 자동 빌드 스크립트 실행                    ← 10~20분
4. 결과물(.exe) 확인                         ← 1분
5. 테스트 설치 & 실행                         ← 5분
```

---

## 🛠️ 1단계: Windows PC에 필수 도구 설치

### 1-1. Python 설치 (Python 서버용)

1. [python.org/downloads](https://www.python.org/downloads/) 접속
2. **"Download Python 3.12.x"** (또는 최신 3.x 버전) 클릭
3. 다운로드된 설치 파일 실행
4. ⚠️ **꼭 체크!** → **"Add Python to PATH"** 박스 **체크** 필수
5. **"Install Now"** 클릭
6. 설치 완료 후 확인:
   - `Windows 키 + R` → `cmd` 입력 → Enter
   - 검은 창에서 `python --version` 입력
   - `Python 3.12.x` 같은 버전 숫자가 나오면 성공 ✅

### 1-2. Node.js 설치 (Electron + Next.js용)

1. [nodejs.org](https://nodejs.org/) 접속
2. **"LTS" 버전** (왼쪽 녹색 버튼) 다운로드
3. 설치 파일 실행 → 기본 설정 그대로 **Next, Next** 진행
4. 설치 완료 후 확인:
   - `cmd` 창에서 `node --version`
   - `v20.x.x` 같은 버전이 나오면 성공 ✅

### 1-3. Git 설치 (코드 받기용)

1. [git-scm.com/download/win](https://git-scm.com/download/win) 접속
2. 자동 다운로드됨 → 설치 파일 실행
3. 옵션은 대부분 **기본값 그대로 Next**
4. 설치 완료 후 확인:
   - `cmd` 창에서 `git --version`
   - `git version 2.x.x` 나오면 성공 ✅

### ✅ 1단계 체크

cmd 창에서 아래 3개 명령 모두 버전이 나와야 합니다:
```
python --version
node --version
git --version
```

하나라도 "명령을 찾을 수 없다"고 나오면, **해당 프로그램을 재설치하고 PATH 체크 확인**하세요.

---

## 📥 2단계: 코드 내려받기

1. 원하는 폴더로 이동 (예: `바탕화면`)
2. `Windows 키 + R` → `cmd` → Enter
3. cmd에서 이동:
   ```cmd
   cd %USERPROFILE%\Desktop
   ```
4. GitHub에서 코드 받기:
   ```cmd
   git clone https://github.com/heartblood0509-gif/App_blog_auto3.git
   ```
5. 생성된 폴더로 이동:
   ```cmd
   cd App_blog_auto3
   ```

> 💡 바탕화면에 `App_blog_auto3` 폴더가 생겼으면 성공.

---

## 🏗️ 3단계: 자동 빌드 실행 (가장 쉬운 방법)

프로젝트 루트 폴더에 준비된 **`build-windows.bat`** 파일을 **더블클릭**하면 자동으로:
1. Next.js 빌드
2. PyInstaller로 Python 바이너리 생성
3. Electron으로 `.exe` 설치 파일 생성

까지 한 번에 진행됩니다.

### 실행 방법

**방법 A: 더블클릭 (가장 쉬움)**
1. 파일 탐색기에서 `App_blog_auto3` 폴더 열기
2. **`build-windows.bat`** 파일을 **더블클릭**
3. 검은 명령어 창이 뜨고 자동으로 빌드 진행
4. ⏱️ **10~20분** 기다리기 (의존성 설치 시간)
5. 창이 닫히지 않고 "빌드 완료"라는 메시지가 뜨면 완료

**방법 B: cmd에서 수동 실행**
```cmd
cd %USERPROFILE%\Desktop\App_blog_auto3
build-windows.bat
```

### ⚠️ 중간에 에러가 나면?

1. 처음부터 다시 실행해도 됩니다 (이미 설치된 건 스킵)
2. 특정 단계에서 멈추면 **FAQ 섹션** 참고
3. 스크린샷 찍어서 GitHub Issues에 문의

---

## 🎯 4단계: 결과물 확인

빌드가 성공하면 이 경로에 설치 파일이 생깁니다:

```
App_blog_auto3\release\BlogPublisher-Setup-1.0.0.exe
```

파일 크기는 약 **280~300MB**.

**확인 방법**: 파일 탐색기에서 `App_blog_auto3\release\` 폴더를 열어 `.exe` 파일이 있는지 확인.

---

## 🚀 5단계: 테스트 설치 & 실행

### 설치
1. `BlogPublisher-Setup-1.0.0.exe` **더블클릭**
2. **"Windows Defender SmartScreen" 경고**가 뜨면:
   - **"추가 정보"** 클릭
   - **"실행"** 버튼 클릭
3. 설치 마법사 진행 (경로 선택 등)
4. 완료

### 실행
1. 시작 메뉴에서 **"BlogPublisher"** 검색
2. 실행
3. 최초 실행 시 10~15초 대기 (Python 서버 준비)
4. 앱 창이 뜨면 성공 🎉

### 확인 포인트
- [ ] 앱 창 제목이 "BlogPublisher"인가
- [ ] 헤더 우측에 🔑 열쇠 아이콘이 있는가
- [ ] 🔑 클릭 → Gemini API 키 입력 가능한가
- [ ] 네이버 계정 등록 → 실제 발행까지 되는가

Mac 버전과 **동일하게 작동**해야 정상입니다.

---

## ❓ 자주 발생하는 문제 (FAQ)

### Q. "python은 내부 또는 외부 명령어가 아닙니다"

→ Python 설치 시 **"Add Python to PATH"** 체크 안 함. 재설치 필요:
1. 기존 Python 제거 (설정 → 앱 → Python 제거)
2. 재설치 시 꼭 **"Add Python to PATH"** 체크

### Q. PyInstaller 단계에서 에러 `ModuleNotFoundError`

→ 특정 모듈이 `BlogPublisher.spec`에 누락된 경우. cmd 창에서:
```cmd
pip install <모듈명>
```
설치 후 재빌드. 그래도 안 되면 `BlogPublisher.spec`의 `hiddenimports`에 추가.

### Q. Playwright 관련 에러

→ Chromium 다운로드 누락:
```cmd
cd publisher
playwright install chromium
```

### Q. Electron 빌드 중 `code signing` 에러

→ Windows 인증서 없이도 빌드는 가능합니다. 경고 메시지는 무시해도 됩니다.

### Q. 빌드 시간이 너무 오래 걸려요

→ 첫 빌드는 의존성 다운로드가 많아 20~30분 걸릴 수 있습니다. 두 번째부터는 5~10분.

### Q. 설치 후 앱이 실행 안 돼요

→ Windows Defender가 PyInstaller 바이너리를 차단한 경우:
1. Windows 보안 → 바이러스 및 위협 방지
2. 예외 추가: `BlogPublisher` 폴더 전체
3. 재실행

### Q. "서버 연결 중..." 에러 (발행 시)

→ Python 서버가 안 뜬 경우. 방화벽이 막았을 수 있음:
1. Windows 방화벽 → 앱 허용
2. `BlogPublisher.exe` 허용
3. 앱 재시작

---

## 🔄 한 번 성공한 후 다시 빌드할 때

처음 한 번은 오래 걸리지만, 이후엔:

1. 코드 수정 후
2. `build-windows.bat` 더블클릭
3. **5~10분** 만에 새 `.exe` 완성

---

## 💡 Windows PC가 없다면?

### 대안 1: 가상머신(VM)
- **VirtualBox** (무료) + Windows 11 평가판 설치
- Mac 위에서 Windows 실행 가능
- 단, M1/M2/M3/M4 Mac은 **UTM 또는 Parallels** 필요

### 대안 2: GitHub Actions (추천)
- GitHub 서버가 Mac + Windows **둘 다 자동 빌드**
- Windows PC 없이도 가능
- 사용자가 "GitHub Actions 설정해줘"라고 요청하면 구성 가능

---

## 📞 도움이 필요하면

- 빌드 중 에러 발생 시: [GitHub Issues](https://github.com/heartblood0509-gif/App_blog_auto3/issues)
- 스크린샷 + 에러 메시지 + 어느 단계인지 알려주세요
