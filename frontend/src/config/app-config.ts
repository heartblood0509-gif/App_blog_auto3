/** 앱 설정 — Electron 데스크톱 앱 모드 */
export const appConfig = {
  mode: "desktop" as const,
  isCompany: true,  // 인증은 Keygen 라이선스로 처리하므로 기능 제한 없음
  isUser: false,    // NextAuth 사용 안 함

  appName: "BlogPublisher",

  features: {
    blogGeneration: true,
    threadGeneration: true,
    imageAnalysis: true,
    productPreset: true,
    templateSave: true,
    contentConversion: true,
    history: true,
    naverPublishing: true,
  },
};
