/**
 * Attach a password to an existing Drupal account that has none
 * (typical for eCitizen SSO users).
 */
export async function appSetPassword(data: {
  email: string;
  password: string;
  phone?: string;
}): Promise<{
  data: {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    token_type?: string;
  };
  created: boolean;
} | null> {
  const apiUrl = (process.env.API_URL || '').replace(/\/$/, '');
  if (!apiUrl) {
    return null;
  }

  const response = await fetch(`${apiUrl}/api/v1/user/app-set-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(process.env.EXTERNAL_API_KEY
        ? { 'X-API-Key': process.env.EXTERNAL_API_KEY }
        : {}),
    },
    body: JSON.stringify({
      email: data.email,
      password: data.password,
      phone: data.phone || '',
    }),
  });

  const json = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    created?: boolean;
    code?: string;
    error?: string;
    data?: { access_token?: string; refresh_token?: string };
  };

  if (response.status === 404 || json.code === 'not_found') {
    return null;
  }

  const accessToken = String(json.data?.access_token || '');
  const refreshToken = String(json.data?.refresh_token || '');
  if (!response.ok || !accessToken || !refreshToken) {
    if (json.code === 'has_password') {
      throw new Error('Invalid email or password');
    }
    throw new Error(json.error || 'Could not save password for this account.');
  }

  return {
    created: Boolean(json.created),
    data: {
      access_token: accessToken,
      refresh_token: refreshToken,
    },
  };
}
