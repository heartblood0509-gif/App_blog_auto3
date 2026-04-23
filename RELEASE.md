# 릴리스 워크플로우 (개발자용)

BlogPublisher 새 버전을 빌드하고 사용자에게 자동 배포하는 방법.

---

## 📋 릴리스 흐름 개요

```
1. 코드 수정  → 2. 버전 업  → 3. 빌드  → 4. GitHub Release 생성
                                            ↓
                          사용자 앱이 자동 감지 → 알림 → 업데이트
```

**사용자는 앱을 한 번만 설치하면 됩니다.** 이후 업데이트는 모두 자동.

---

## 🚀 릴리스 순서

### 1단계: 버전 번호 올리기

`electron/package.json`의 `"version"` 필드를 수정:

```json
{
  "name": "blog-publisher",
  "version": "1.0.1",  ← 이 숫자를 올림
  ...
}
```

**버전 규칙 (Semantic Versioning)**:
- `1.0.0` → `1.0.1` : 버그 수정 (Patch)
- `1.0.0` → `1.1.0` : 기능 추가 (Minor)
- `1.0.0` → `2.0.0` : 큰 변경 (Major)

### 2단계: 전체 빌드

```bash
# 1. Next.js 프로덕션 빌드 (standalone 모드)
cd frontend
npm run build

# 2. PyInstaller로 Python 서버 바이너리 생성
cd ../publisher
python3 -m PyInstaller BlogPublisher.spec --clean --noconfirm

# 3. Electron DMG 빌드
cd ../electron
npx tsc
npx electron-builder --mac
```

**결과물**: `release/BlogPublisher-{버전}-arm64.dmg`

### 3단계: GitHub Release 생성 및 업로드

#### 방법 A: 웹에서 수동 업로드 (가장 간단)

1. [Releases 페이지](https://github.com/heartblood0509-gif/App_blog_auto3/releases) 접속
2. **"Draft a new release"** 클릭
3. **"Choose a tag"** → 새 태그 입력 (예: `v1.0.1`)
4. 제목과 릴리스 노트 작성:
   ```
   제목: v1.0.1 - 버그 수정
   
   본문:
   ## 변경사항
   - 네이버 로그인 안정성 개선
   - 블로그 생성 속도 향상
   
   ## 다운로드
   - Mac (Apple Silicon): BlogPublisher-1.0.1-arm64.dmg
   ```
5. **"Attach files by dragging & dropping"** 영역에 다음 파일 업로드:
   - `release/BlogPublisher-1.0.1-arm64.dmg`
   - `release/BlogPublisher-1.0.1-arm64.dmg.blockmap`
   - `release/latest-mac.yml` ⚠️ **필수** (자동 업데이트 메타데이터)
6. **"Publish release"** 클릭

> ⚠️ **`latest-mac.yml` 파일을 반드시 업로드하세요.** 이게 없으면 사용자 앱이 새 버전을 감지하지 못합니다.

#### 방법 B: electron-builder로 자동 업로드 (선택)

```bash
# GitHub Personal Access Token 필요 (repo 권한)
export GH_TOKEN=your_github_token

cd electron
npx electron-builder --mac --publish always
```

Token 생성: https://github.com/settings/tokens/new (권한: `repo`)

### 4단계: 자동 업데이트 동작 확인

1. 이전 버전(`v1.0.0`)이 설치된 PC에서 앱 실행
2. 앱 시작 직후 **"새 버전 있어요 (v1.0.1)"** 알림이 떠야 함
3. "다운로드" → "재시작" → 새 버전 적용 확인

> 💡 업데이트 감지는 **앱 시작 시 1번만** 체크합니다.
> 이미 앱이 열려있으면 재시작 후에 알림이 떠요.

---

## 🪟 Windows 빌드 (별도 작업)

Windows `.exe`는 **Windows PC에서 따로 빌드**해야 합니다.
Mac에서 Windows 바이너리를 만들 수는 있지만, Python 바이너리가 Mac용이라 작동하지 않습니다.

### Windows PC에서
```bash
# 1. Git 클론
git clone https://github.com/heartblood0509-gif/App_blog_auto3.git
cd App_blog_auto3

# 2. 의존성 설치
cd frontend && npm install
cd ../electron && npm install
cd ../publisher && pip install -r requirements.txt
pip install pyinstaller

# 3. 빌드
cd ../frontend && npm run build
cd ../publisher && pyinstaller BlogPublisher.spec --clean --noconfirm
cd ../electron && npx tsc && npx electron-builder --win

# 결과물: release/BlogPublisher-Setup-{버전}.exe
```

### GitHub Release에 Windows 파일도 함께 업로드
- `BlogPublisher-Setup-1.0.1.exe`
- `BlogPublisher-Setup-1.0.1.exe.blockmap`
- `latest.yml` (Windows 자동 업데이트 메타데이터)

---

## 🔍 릴리스 후 확인 체크리스트

- [ ] GitHub Releases 페이지에 새 릴리스가 "Latest"로 표시됨
- [ ] `.dmg` 파일 다운로드 가능
- [ ] `latest-mac.yml` 업로드됨
- [ ] 이전 버전 설치된 PC에서 자동 업데이트 알림 확인
- [ ] 새 기능/수정사항이 실제로 반영됨

---

## 🛠️ 문제 해결

### "자동 업데이트가 안 떠요"
- `latest-mac.yml` 파일이 Release에 첨부되었는지 확인
- 버전 번호가 실제로 올라갔는지 확인 (같은 버전이면 업데이트 없음)
- 앱을 완전히 종료 후 재실행 (⌘Q)

### "빌드 중 에러"
- Next.js: `frontend/.next/` 삭제 후 재빌드
- PyInstaller: `publisher/build/`, `publisher/dist/` 삭제 후 재빌드
- Electron: `electron/dist/`, `release/` 삭제 후 재빌드

### "PyInstaller 빌드가 특정 모듈 못 찾아요"
`publisher/BlogPublisher.spec`의 `hiddenimports` 리스트에 모듈명 추가:
```python
hiddenimports += ["missing_module_name"]
```

### "포트 충돌"
`electron/src/next-server.ts`의 `NEXT_PORT`가 `3847`로 설정되어 있어야 함. 다른 포트 사용 시 `publisher/server.py`의 CORS 허용 목록도 함께 수정 필요.

---

## 📁 중요 파일 위치

| 파일 | 용도 |
|---|---|
| `electron/package.json` | 버전 번호 + electron-builder 설정 |
| `electron/src/next-server.ts` | Electron 내부 Next.js 포트 설정 |
| `publisher/BlogPublisher.spec` | PyInstaller 빌드 설정 |
| `publisher/server.py` | CORS 허용 목록 |
| `frontend/next.config.ts` | Next.js standalone 모드 설정 |
| `release/` | 빌드 결과물 (DMG, EXE, yml 등) |

---

## 📝 릴리스 노트 예시

```markdown
## v1.0.1 (2026-04-23)

### 🎉 새 기능
- 쓰레드 이미지 생성 시 레이아웃 선택 추가

### 🐛 버그 수정
- 네이버 로그인 2FA 대기 시간 연장 (30초 → 2분)
- 블로그 생성 중 빈 섹션 방지

### ⚡ 개선
- 앱 시작 속도 향상 (Python 바이너리 최적화)

### 📥 다운로드
- Mac (M1/M2/M3/M4): BlogPublisher-1.0.1-arm64.dmg
- Windows: BlogPublisher-Setup-1.0.1.exe
```

---

## 💡 팁

- **첫 릴리스는 "pre-release"로 마킹**해서 베타 테스터에게만 먼저 배포 가능
- 큰 변경 전에는 **main 브랜치에서 dev 브랜치로 작업** 후 머지
- **릴리스 노트는 사용자가 읽는 유일한 정보**이니 정성 들이기
