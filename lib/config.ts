// =============================================================================
// Application Configuration
// 환경별 설정 관리
// =============================================================================

// Environment type
type Environment = 'development' | 'staging' | 'production';

// Get current environment
function getEnvironment(): Environment {
  const env = process.env.NODE_ENV;
  if (env === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'staging';
  return 'development';
}

// Configuration interface
interface Config {
  env: Environment;
  isProduction: boolean;
  isDevelopment: boolean;

  // App
  appName: string;
  appUrl: string;
  apiUrl: string;

  // Database
  databaseUrl: string;

  // Auth
  nextAuthUrl: string;
  nextAuthSecret: string;

  // OAuth
  googleClientId: string;
  googleClientSecret: string;
  kakaoClientId: string;
  kakaoClientSecret: string;
  naverClientId: string;
  naverClientSecret: string;

  // AI Services
  openaiApiKey: string;
  googleAiApiKey: string;

  // AWS
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsS3Bucket: string;

  // Public Data API
  publicDataKey: string;

  // Payment (Toss)
  tossClientKey: string;
  tossSecretKey: string;

  // Email
  emailProvider: string;
  emailApiKey: string;
  emailFrom: string;

  // Kakao Alimtalk
  kakaoAlimtalkApiKey: string;
  kakaoAlimtalkSenderKey: string;

  // Security
  idHashSalt: string;

  // Credits
  creditRates: {
    chat: number;
    document: number;
    review: number;
    submission: number;
  };

  // Subscription Plans
  plans: {
    basic: { price: number; credits: number };
    pro: { price: number; credits: number };
    enterprise: { price: number; credits: number };
  };
}

// Environment-specific defaults
const envDefaults: Record<Environment, Partial<Config>> = {
  development: {
    appUrl: 'http://localhost:3000',
    apiUrl: 'http://localhost:3000/api',
  },
  staging: {
    appUrl: 'https://staging.admini.co.kr',
    apiUrl: 'https://staging.admini.co.kr/api',
  },
  production: {
    appUrl: 'https://admini.co.kr',
    apiUrl: 'https://admini.co.kr/api',
  },
};

// Build configuration
function buildConfig(): Config {
  const env = getEnvironment();
  const defaults = envDefaults[env];

  return {
    env,
    isProduction: env === 'production',
    isDevelopment: env === 'development',

    // App
    appName: 'AI행정사 어드미니',
    appUrl: process.env.NEXT_PUBLIC_APP_URL || defaults.appUrl || 'http://localhost:3000',
    apiUrl: process.env.NEXT_PUBLIC_API_URL || defaults.apiUrl || 'http://localhost:3000/api',

    // Database
    databaseUrl: process.env.DATABASE_URL || '',

    // Auth
    nextAuthUrl: process.env.NEXTAUTH_URL || defaults.appUrl || 'http://localhost:3000',
    nextAuthSecret: process.env.NEXTAUTH_SECRET || 'development-secret',

    // OAuth
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    kakaoClientId: process.env.KAKAO_CLIENT_ID || '',
    kakaoClientSecret: process.env.KAKAO_CLIENT_SECRET || '',
    naverClientId: process.env.NAVER_CLIENT_ID || '',
    naverClientSecret: process.env.NAVER_CLIENT_SECRET || '',

    // AI Services
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    googleAiApiKey: process.env.GOOGLE_AI_API_KEY || '',

    // AWS
    awsRegion: process.env.AWS_REGION || 'ap-northeast-2',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    awsS3Bucket: process.env.AWS_S3_BUCKET || '',

    // Public Data API
    publicDataKey: process.env.PUBLIC_DATA_KEY || '',

    // Payment (Toss)
    tossClientKey: process.env.TOSS_CLIENT_KEY || '',
    tossSecretKey: process.env.TOSS_SECRET_KEY || '',

    // Email
    emailProvider: process.env.EMAIL_PROVIDER || 'resend',
    emailApiKey: process.env.EMAIL_API_KEY || '',
    emailFrom: process.env.EMAIL_FROM || 'noreply@admini.co.kr',

    // Kakao Alimtalk
    kakaoAlimtalkApiKey: process.env.KAKAO_ALIMTALK_API_KEY || '',
    kakaoAlimtalkSenderKey: process.env.KAKAO_ALIMTALK_SENDER_KEY || '',

    // Security
    idHashSalt: process.env.ID_HASH_SALT || 'admini-secure-salt-2024',

    // Credits (가격표 - 수정된 요금)
    creditRates: {
      chat: 1,        // AI 채팅 1회
      document: 10,   // 서류 생성 1건
      review: 5,      // 서류 검토 1건
      submission: 50, // RPA 민원 접수 1건
    },

    // Subscription Plans (수정된 요금)
    plans: {
      basic: { price: 99000, credits: 500 },      // 일반: 99,000원/월
      pro: { price: 150000, credits: 2000 },      // 프로: 150,000원/월
      enterprise: { price: 0, credits: -1 },       // 기업: 협의, 무제한(-1)
    },
  };
}

// Export singleton config
export const config = buildConfig();

// Validation helper
export function validateConfig(): { valid: boolean; missing: string[] } {
  const required = [
    'databaseUrl',
    'nextAuthSecret',
  ];

  const missing = required.filter(
    (key) => !config[key as keyof Config]
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}

// Feature flags
export const features = {
  // OAuth providers enabled
  googleLogin: !!config.googleClientId,
  kakaoLogin: !!config.kakaoClientId,
  naverLogin: !!config.naverClientId,

  // Payment enabled
  payment: !!config.tossClientKey,

  // Notifications enabled
  emailNotifications: !!config.emailApiKey,
  kakaoNotifications: !!config.kakaoAlimtalkApiKey,

  // AI services
  openai: !!config.openaiApiKey,
  gemini: !!config.googleAiApiKey,

  // Storage
  s3Storage: !!config.awsAccessKeyId,
};

export default config;
