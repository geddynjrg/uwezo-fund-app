const fs = require('fs');

const enPath = '/las/web/messages/en.json';
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
en.LoginPage.otpDeliveryFailed =
  'Unable to send the verification code by SMS, email, or the Uwezo Fund app. Please try eCitizen or email/password login.';
en.LoginPage.otpSentApp =
  'SMS/email unavailable — code sent to the Uwezo Fund app. Open the app and check Notifications.';
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n');
console.log('en.json patched');

const phpPath =
  '/las/admin/web/modules/custom/common/api_auth/src/Service/OtpAuthService.php';
let php = fs.readFileSync(phpPath, 'utf8');

const oldFailBlock = `    $resolved_email = $this->normalizeEmail($email) ?: $this->findEmailForPhone($phone_number);
    if (!$resolved_email) {
      $this->cache->delete($this->getOtpCacheKey($request_id));
      return [
        'success' => FALSE,
        'need_email' => TRUE,
        'error' => $this->t('SMS unavailable. Provide the email linked to this phone to receive a code, or use eCitizen / password login.'),
      ];
    }

    if (!$this->sendOtpEmail($resolved_email, $otp_code)) {
      $this->cache->delete($this->getOtpCacheKey($request_id));
      return [
        'success' => FALSE,
        'error' => $this->t('SMS and email delivery both failed. Try eCitizen or email/password login.'),
      ];
    }

    $this->updateRateLimit($phone_number);
    $this->updateIpRateLimit();
    $masked = $this->maskEmail($resolved_email);

    return [
      'success' => TRUE,
      'request_id' => $request_id,
      'delivery_channel' => 'email',
      'masked_email' => $masked,
      'message' => $this->t('SMS unavailable — we sent a code to your email (@email). Enter it here.', [
        '@email' => $masked,
      ]),
      'expires_in' => $expiry,
    ];
  }`;

const newFailBlock = `    $resolved_email = $this->normalizeEmail($email) ?: $this->findEmailForPhone($phone_number);
    if ($resolved_email) {
      if ($this->sendOtpEmail($resolved_email, $otp_code)) {
        $this->updateRateLimit($phone_number);
        $this->updateIpRateLimit();
        $masked = $this->maskEmail($resolved_email);
        return [
          'success' => TRUE,
          'request_id' => $request_id,
          'delivery_channel' => 'email',
          'masked_email' => $masked,
          'message' => $this->t('SMS unavailable — we sent a code to your email (@email). Enter it here.', [
            '@email' => $masked,
          ]),
          'expires_in' => $expiry,
        ];
      }
      \\Drupal::logger('api_auth')->warning('OTP email failed for @phone; attempting Uwezo Fund app delivery.', [
        '@phone' => $this->maskPhoneNumber($phone_number),
      ]);
      if ($this->notifyAppPushOtp($phone_number, $message, $resolved_email)) {
        $this->updateRateLimit($phone_number);
        $this->updateIpRateLimit();
        return [
          'success' => TRUE,
          'request_id' => $request_id,
          'delivery_channel' => 'app',
          'message' => $this->t('SMS and email were unavailable — we sent your login code to the Uwezo Fund app. Open the app (check Notifications) and enter the 6-digit code here.'),
          'expires_in' => $expiry,
        ];
      }
      $this->cache->delete($this->getOtpCacheKey($request_id));
      return [
        'success' => FALSE,
        'error' => $this->t('SMS, email, and Uwezo Fund app delivery all failed. Try eCitizen or email/password login.'),
      ];
    }

    if ($this->notifyAppPushOtp($phone_number, $message, $email)) {
      $this->updateRateLimit($phone_number);
      $this->updateIpRateLimit();
      return [
        'success' => TRUE,
        'request_id' => $request_id,
        'delivery_channel' => 'app',
        'message' => $this->t('SMS unavailable — we sent your login code to the Uwezo Fund app. Open the app (check Notifications) and enter the 6-digit code here.'),
        'expires_in' => $expiry,
      ];
    }

    $this->cache->delete($this->getOtpCacheKey($request_id));
    return [
      'success' => FALSE,
      'need_email' => TRUE,
      'error' => $this->t('SMS unavailable. Provide the email linked to this phone, open the Uwezo Fund app if signed in, or use eCitizen / password login.'),
    ];
  }`;

if (!php.includes(oldFailBlock)) {
  console.error('PHP fail block not found');
  process.exit(1);
}
php = php.replace(oldFailBlock, newFailBlock);

const newNotify = `
  /**
   * Notify signed-in Uwezo Fund app (inbox/FCM). Returns TRUE when a device was targeted.
   */
  protected function notifyAppPushOtp(string $phone_number, string $message, ?string $email = NULL): bool {
    $url = getenv('APP_PUSH_NOTIFY_URL') ?: '';
    $secret = getenv('APP_PUSH_WEBHOOK_SECRET') ?: '';
    if ($url === '' || $secret === '') {
      return FALSE;
    }
    try {
      $payload = json_encode([
        'kind' => 'otp',
        'title' => 'Uwezo Fund login code',
        'body' => $message,
        'phone' => $phone_number,
        'email' => $email,
      ]);
      $ch = curl_init($url);
      curl_setopt($ch, CURLOPT_POST, TRUE);
      curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $secret,
      ]);
      curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
      curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
      curl_setopt($ch, CURLOPT_TIMEOUT, 3);
      $raw = curl_exec($ch);
      $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
      curl_close($ch);
      if ($code < 200 || $code >= 300 || !is_string($raw) || $raw === '') {
        return FALSE;
      }
      $json = json_decode($raw, TRUE);
      return !empty($json['delivered']) || (!empty($json['devices']) && (int) $json['devices'] > 0);
    }
    catch (\\Throwable $e) {
      return FALSE;
    }
  }

`;

php = php.replace(
  /\/\*\*\s*\n\s*\* Best-effort app push companion for EBIS OTP SMS\.\s*\n\s*\*\/\s*\n\s*protected function notifyAppPushOtp\(string \$phone_number, string \$message, \?string \$email = NULL\): void \{[\s\S]*?\n  \}\n\n\}/,
  newNotify + '\n}',
);

if (!php.includes('function notifyAppPushOtp(string $phone_number, string $message, ?string $email = NULL): bool')) {
  console.error('notify return type patch failed');
  process.exit(1);
}

fs.writeFileSync(phpPath, php);
console.log('php patched');
