<?php

namespace Drupal\api_auth\Controller;

use Drupal\api_auth\Service\ApiJwtService;
use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Password\PasswordInterface;
use Drupal\user\UserInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Lets the Uwezo app save a password on an existing eCitizen account.
 *
 * eCitizen SSO creates Drupal users without a password, so app email/password
 * sign-in previously failed. First password from the app is stored when the
 * account has no usable password. Existing passwords are never overwritten.
 */
class AppSetPasswordController extends ControllerBase {

  public function __construct(
    protected ApiJwtService $jwtService,
    protected PasswordInterface $passwordService,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('api_auth.jwt_service'),
      $container->get('password'),
    );
  }

  /**
   * POST /api/v1/user/app-set-password
   */
  public function setPassword(Request $request) {
    $data = json_decode($request->getContent(), TRUE);
    if (!is_array($data)) {
      return $this->error('Invalid JSON.', 400);
    }

    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $password = (string) ($data['password'] ?? '');
    $phone = trim((string) ($data['phone'] ?? ''));

    if ($email === '' || $password === '') {
      return $this->error('Email and password are required.', 400);
    }
    if (strlen($password) < 8) {
      return $this->error('Password must be at least 8 characters.', 400);
    }

    $user = $this->findUser($email, $phone);
    if (!$user instanceof UserInterface) {
      return $this->error('Account not found.', 404, 'not_found');
    }
    if (!$user->isActive()) {
      return $this->error('Account is not active.', 403);
    }

    $stored = $user->getPassword();
    $has_password = is_string($stored) && $stored !== '';

    if ($has_password) {
      if ($this->passwordService->check($password, $stored)) {
        $this->maybeSetPhone($user, $phone);
        return $this->tokens($user, FALSE);
      }
      return $this->error('Invalid email or password.', 401, 'has_password');
    }

    $account_phone = $this->userPhone($user);
    if ($account_phone !== '' && $phone !== '' && !$this->phonesMatch($account_phone, $phone)) {
      return $this->error(
        'Use the mobile number on this eCitizen account to save a password.',
        403,
        'phone_mismatch',
      );
    }

    $user->setPassword($password);
    if ($user->getEmail() === '' || $user->getEmail() === NULL) {
      $user->setEmail($email);
    }
    $this->maybeSetPhone($user, $phone, TRUE);
    $user->save();

    $this->getLogger('api_auth')->info('App saved password for passwordless user @uid (@mail)', [
      '@uid' => $user->id(),
      '@mail' => $user->getEmail(),
    ]);

    return $this->tokens($user, TRUE);
  }

  /**
   * Finds an active user by email, username, or phone.
   */
  protected function findUser(string $email, string $phone): ?UserInterface {
    $storage = $this->entityTypeManager()->getStorage('user');

    $users = $storage->loadByProperties(['mail' => $email]);
    $user = reset($users);
    if ($user instanceof UserInterface) {
      return $user;
    }

    $users = $storage->loadByProperties(['name' => $email]);
    $user = reset($users);
    if ($user instanceof UserInterface) {
      return $user;
    }

    $username = explode('@', $email)[0] ?? '';
    if ($username !== '' && $username !== $email) {
      $users = $storage->loadByProperties(['name' => $username]);
      $user = reset($users);
      if ($user instanceof UserInterface) {
        return $user;
      }
    }

    if ($phone === '') {
      return NULL;
    }

    $variants = $this->phoneVariants($phone);
    if (!$variants) {
      return NULL;
    }

    try {
      $ids = $storage->getQuery()
        ->accessCheck(FALSE)
        ->condition('status', 1)
        ->condition('field_phone_number', $variants, 'IN')
        ->range(0, 5)
        ->execute();
    }
    catch (\Exception $e) {
      return NULL;
    }

    if (!$ids) {
      return NULL;
    }

    $loaded = $storage->loadMultiple($ids);
    foreach ($loaded as $candidate) {
      if ($candidate instanceof UserInterface && $this->phonesMatch($this->userPhone($candidate), $phone)) {
        return $candidate;
      }
    }

    $first = reset($loaded);
    return $first instanceof UserInterface ? $first : NULL;
  }

  /**
   * Stores phone when the account has none.
   */
  protected function maybeSetPhone(UserInterface $user, string $phone, bool $force_empty = FALSE): void {
    if ($phone === '' || !$user->hasField('field_phone_number')) {
      return;
    }
    $current = $this->userPhone($user);
    if ($current !== '' && !$force_empty) {
      return;
    }
    if ($current !== '' && $this->phonesMatch($current, $phone)) {
      return;
    }
    if ($current === '') {
      $user->set('field_phone_number', $phone);
    }
  }

  protected function userPhone(UserInterface $user): string {
    if (!$user->hasField('field_phone_number') || $user->get('field_phone_number')->isEmpty()) {
      return '';
    }
    return trim((string) $user->get('field_phone_number')->value);
  }

  protected function phoneDigits(string $raw): string {
    return preg_replace('/\D+/', '', $raw) ?? '';
  }

  protected function phonesMatch(string $a, string $b): bool {
    $da = $this->phoneDigits($a);
    $db = $this->phoneDigits($b);
    if ($da === '' || $db === '') {
      return FALSE;
    }
    return substr($da, -9) === substr($db, -9);
  }

  /**
   * @return string[]
   */
  protected function phoneVariants(string $raw): array {
    $digits = $this->phoneDigits($raw);
    if ($digits === '') {
      return [];
    }
    if (str_starts_with($digits, '0') && strlen($digits) === 10) {
      $digits = '254' . substr($digits, 1);
    }
    elseif (strlen($digits) === 9 && preg_match('/^[17]/', $digits)) {
      $digits = '254' . $digits;
    }
    $local = str_starts_with($digits, '254') && strlen($digits) === 12
      ? '0' . substr($digits, 3)
      : $digits;
    $national = str_starts_with($digits, '254') ? substr($digits, 3) : $digits;

    return array_values(array_unique(array_filter([
      $raw,
      $digits,
      '+' . $digits,
      $local,
      $national,
      '0' . $national,
      '+254' . $national,
      '254' . $national,
    ])));
  }

  protected function tokens(UserInterface $user, bool $created): JsonResponse {
    $tokens = $this->jwtService->generateTokens($user);
    return new JsonResponse([
      'ok' => TRUE,
      'created' => $created,
      'data' => [
        'access_token' => $tokens['access_token'],
        'refresh_token' => $tokens['refresh_token'],
        'expires_in' => $tokens['expires_in'],
        'token_type' => 'Bearer',
      ],
    ]);
  }

  protected function error(string $message, int $status, ?string $code = NULL): JsonResponse {
    $payload = [
      'ok' => FALSE,
      'error' => $message,
    ];
    if ($code) {
      $payload['code'] = $code;
    }
    return new JsonResponse($payload, $status);
  }

}
