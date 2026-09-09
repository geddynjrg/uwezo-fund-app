/** Public links used on the home screen (from Uwezo portal branding). */
export const LINKS = {
  majuu: {
    id: 'majuu',
    title: 'Wezesha Majuu',
    subtitle: 'Youth & women enterprise portal',
    url: 'https://majuu.uwezo.go.ke',
  },
  loans: {
    id: 'loans',
    title: 'Loan application',
    subtitle: 'Apply or track on loans.uwezo.go.ke',
    url: 'https://loans.uwezo.go.ke',
  },
  loansStaging: {
    id: 'loans-staging',
    title: 'Loans (staging)',
    subtitle: 'Optional staging environment',
    // Override with VITE_LOANS_STAGING_URL if your staging host differs
    url:
      (import.meta.env.VITE_LOANS_STAGING_URL as string | undefined)?.trim() ||
      'https://loans.uwezo.go.ke',
  },
  website: {
    id: 'website',
    title: 'Website',
    subtitle: 'Official Uwezo Fund public site',
    url: 'https://www.uwezo.go.ke',
  },
} as const;

/**
 * OTP chat talks to the same assistive-chat login API used by Majuu/loans Help chat.
 * Override with VITE_OTP_API_BASE (e.g. https://majuu.uwezo.go.ke or https://loans.uwezo.go.ke).
 */
export const OTP_API_BASE =
  (import.meta.env.VITE_OTP_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  'https://majuu.uwezo.go.ke';

export const OTP_LOGIN_PATH = '/api/assistive-chat/login';

/** Deep-link into Majuu Help chat when in-app OTP cannot complete (CORS / network). */
export const MAJUU_HELP_URL = 'https://majuu.uwezo.go.ke';

export const APP_NAME = 'Uwezo Fund';
export const APP_TAGLINE = 'Ahadi Yetu — Kazi Kwako';
