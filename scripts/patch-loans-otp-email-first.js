/**
 * Prefer email OTP over SMS on the live Loans Drupal OtpAuthService.
 * Run on the loans host (paths match existing patch-loans-otp-app.js).
 *
 *   node scripts/patch-loans-otp-email-first.js
 */
const fs = require('fs');

const phpPath =
  process.env.OTP_AUTH_SERVICE_PATH ||
  '/las/admin/web/modules/custom/common/api_auth/src/Service/OtpAuthService.php';

let php = fs.readFileSync(phpPath, 'utf8');

const oldSmsFirst = `    // Send SMS first.
    $message_template = $config->get(self::CONFIG_MESSAGE_TEMPLATE) ?: 'Your login code is: [code]';
    $message = str_replace('[code]', $otp_code, $message_template);

    $sms_result = $this->smsService->sendSms($phone_number, $message);
    // Also notify signed-in Uwezo Fund app (inbox/FCM).
    $app_notified = $this->notifyAppPushOtp($phone_number, $message, $email);
    if (!empty($sms_result['success'])) {
      $this->updateRateLimit($phone_number);
      $this->updateIpRateLimit();

      return [
        'success' => TRUE,
        'request_id' => $request_id,
        'delivery_channel' => 'sms',
        'message' => $this->t('Verification code sent by SMS to @phone and to the Uwezo Fund app if you stayed signed in. Enter the 6-digit code here.', [
          '@phone' => $this->maskPhoneNumber($phone_number),
        ]),
        'expires_in' => $expiry,
      ];
    }

    // SMS failed — email failover (same OTP). WhatsApp is not used yet
    // (Meta Business API still test-only for this tenant).
    \\Drupal::logger('api_auth')->warning('OTP SMS failed for @phone; attempting email failover.', [
      '@phone' => $this->maskPhoneNumber($phone_number),
    ]);

    $resolved_email = $this->normalizeEmail($email) ?: $this->findEmailForPhone($phone_number);
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
          'message' => $this->t('SMS unavailable — we sent a code to your email (@email) and to the Uwezo Fund app if you stayed signed in. Enter it here.', [
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

    if ($this->notifyAppPushOtp($phone_number, $message, $email) || $app_notified) {
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

    // Keep the OTP so a late SMS or Uwezo Fund app notification can
    // still be entered.
    $this->updateRateLimit($phone_number);
    $this->updateIpRateLimit();
    return [
      'success' => TRUE,
      'request_id' => $request_id,
      'delivery_channel' => 'app',
      'message' => $this->t('We could not confirm SMS. If you stayed signed in on the Uwezo Fund app, open Notifications for the 6-digit code and enter it here.'),
      'expires_in' => $expiry,
    ];
  }`;

const newEmailFirst = `    // Prefer email first; fall back to SMS, then Uwezo Fund app.
    // WhatsApp is not used yet (Meta Business API still test-only).
    $message_template = $config->get(self::CONFIG_MESSAGE_TEMPLATE) ?: 'Your login code is: [code]';
    $message = str_replace('[code]', $otp_code, $message_template);

    $resolved_email = $this->normalizeEmail($email) ?: $this->findEmailForPhone($phone_number);
    if ($resolved_email) {
      if ($this->sendOtpEmail($resolved_email, $otp_code)) {
        $this->notifyAppPushOtp($phone_number, $message, $resolved_email);
        $this->updateRateLimit($phone_number);
        $this->updateIpRateLimit();
        $masked = $this->maskEmail($resolved_email);
        return [
          'success' => TRUE,
          'request_id' => $request_id,
          'delivery_channel' => 'email',
          'masked_email' => $masked,
          'message' => $this->t('Verification code sent to your email (@email) and to the Uwezo Fund app if you stayed signed in. Enter the 6-digit code here.', [
            '@email' => $masked,
          ]),
          'expires_in' => $expiry,
        ];
      }
      \\Drupal::logger('api_auth')->warning('OTP email failed for @phone; attempting SMS failover.', [
        '@phone' => $this->maskPhoneNumber($phone_number),
      ]);
    }
    elseif (empty($this->normalizeEmail($email))) {
      return [
        'success' => FALSE,
        'need_email' => TRUE,
        'error' => $this->t('Enter the email linked to this phone to receive a login code.'),
      ];
    }

    $sms_result = $this->smsService->sendSms($phone_number, $message);
    $app_notified = $this->notifyAppPushOtp($phone_number, $message, $resolved_email ?: $email);
    if (!empty($sms_result['success'])) {
      $this->updateRateLimit($phone_number);
      $this->updateIpRateLimit();

      return [
        'success' => TRUE,
        'request_id' => $request_id,
        'delivery_channel' => 'sms',
        'message' => $this->t('Email unavailable — verification code sent by SMS to @phone and to the Uwezo Fund app if you stayed signed in. Enter the 6-digit code here.', [
          '@phone' => $this->maskPhoneNumber($phone_number),
        ]),
        'expires_in' => $expiry,
      ];
    }

    \\Drupal::logger('api_auth')->warning('OTP SMS failed for @phone; attempting Uwezo Fund app delivery.', [
      '@phone' => $this->maskPhoneNumber($phone_number),
    ]);

    if ($this->notifyAppPushOtp($phone_number, $message, $resolved_email ?: $email) || $app_notified) {
      $this->updateRateLimit($phone_number);
      $this->updateIpRateLimit();
      return [
        'success' => TRUE,
        'request_id' => $request_id,
        'delivery_channel' => 'app',
        'message' => $this->t('Email and SMS were unavailable — we sent your login code to the Uwezo Fund app. Open the app (check Notifications) and enter the 6-digit code here.'),
        'expires_in' => $expiry,
      ];
    }

    $this->updateRateLimit($phone_number);
    $this->updateIpRateLimit();
    return [
      'success' => TRUE,
      'request_id' => $request_id,
      'delivery_channel' => 'app',
      'message' => $this->t('We could not confirm email or SMS. If you stayed signed in on the Uwezo Fund app, open Notifications for the 6-digit code and enter it here.'),
      'expires_in' => $expiry,
    ];
  }`;

if (php.includes('Prefer email first; fall back to SMS')) {
  console.log('Already email-first; nothing to do');
  process.exit(0);
}

if (!php.includes(oldSmsFirst)) {
  console.error('SMS-first block not found — file may already differ. Aborting.');
  process.exit(1);
}

php = php.replace(oldSmsFirst, newEmailFirst);
fs.writeFileSync(phpPath, php);
console.log('Patched OTP delivery to prefer email:', phpPath);
