<?php

namespace Drupal\status_manager_notifications\Service;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\status_manager\Entity\StatusChangeInterface;
use Drupal\status_manager_notifications\Plugin\NotificationProviderManager;

/**
 * Manages and coordinates application status change notifications.
 *
 * Simplified to only handle application entities with clear SMS/email logic.
 * Also delivers loan_status alerts to the Uwezo Fund app (inbox/FCM).
 */
class NotificationManager {

  /**
   * The config factory.
   *
   * @var \Drupal\Core\Config\ConfigFactoryInterface
   */
  protected ConfigFactoryInterface $configFactory;

  /**
   * The logger service.
   *
   * @var \Drupal\Core\Logger\LoggerChannelInterface
   */
  protected $logger;

  /**
   * The token replacement service.
   *
   * @var \Drupal\status_manager_notifications\Service\TokenReplacementService
   */
  protected TokenReplacementService $tokenService;

  /**
   * The plugin manager.
   *
   * @var \Drupal\status_manager_notifications\Plugin\NotificationProviderManager
   */
  protected NotificationProviderManager $providerManager;

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected EntityTypeManagerInterface $entityTypeManager;

  /**
   * Cached provider instances.
   *
   * @var array
   */
  protected array $providers = [];

  /**
   * Constructs a NotificationManager object.
   */
  public function __construct(
    ConfigFactoryInterface $config_factory,
    LoggerChannelFactoryInterface $logger_factory,
    TokenReplacementService $token_service,
    NotificationProviderManager $provider_manager,
    EntityTypeManagerInterface $entity_type_manager,
  ) {
    $this->configFactory = $config_factory;
    $this->logger = $logger_factory->get('status_manager_notifications');
    $this->tokenService = $token_service;
    $this->providerManager = $provider_manager;
    $this->entityTypeManager = $entity_type_manager;
  }

  /**
   * Sends notifications for a status change.
   *
   * @param \Drupal\status_manager\Entity\StatusChangeInterface $status_change
   *   The status change entity.
   *
   * @return array
   *   Array of results from notification attempts.
   */
  public function sendNotifications(StatusChangeInterface $status_change): array {
    $results = [];
    $application = $status_change->getTargetEntity();

    if (!$application || $application->getEntityTypeId() !== 'application') {
      return $results;
    }

    $new_status = $status_change->getNewStatus();
    $config = $this->getNotificationConfig($new_status);

    if (!$config || empty($config['enabled'])) {
      return $results;
    }

    $recipients = $this->getRecipients($application, $config);
    $message = $this->prepareMessage($config, $application, $status_change);
    $app_id = method_exists($application, 'getApplicationId')
      ? (string) $application->getApplicationId()
      : (string) $application->id();

    foreach ($recipients as $recipient) {
      $result = $this->sendNotification($recipient, $config, $message);
      // Always try Uwezo Fund app inbox/push for customer recipients.
      if (($recipient['type'] ?? '') === 'customer') {
        $app_ok = $this->notifyAppPushLoanStatus(
          (string) ($recipient['phone'] ?? ''),
          $recipient['email'] ?? NULL,
          $message['subject'] ?: 'Uwezo Fund loan update',
          $message['sms_body'] ?: $message['email_body'],
          $app_id,
          $new_status,
        );
        $result['app_push'] = $app_ok;
        if ($app_ok) {
          $result['message'] = trim(($result['message'] ?? '') . ' | App notified');
          // Count as success if SMS/email failed but the signed-in app got it.
          if (empty($result['success'])) {
            $result['success'] = TRUE;
            $result['message'] = 'Delivered to Uwezo Fund app (SMS/email unavailable)';
          }
        }
      }
      $results[] = $result;

      if (!empty($result['success'])) {
        $this->logger->info('Notification sent to @recipient for application @app_id', [
          '@recipient' => $recipient['email'] ?? $recipient['phone'],
          '@app_id' => $app_id,
        ]);
      }
      else {
        $this->logger->error('Failed to send notification: @error', [
          '@error' => $result['message'] ?? 'Unknown',
        ]);
      }
    }

    $this->updateNotificationStatus($status_change, $results);

    return $results;
  }

  /**
   * Gets notification configuration for a specific status.
   *
   * @param string $status
   *   The application status.
   *
   * @return array|null
   *   The notification config or NULL.
   */
  protected function getNotificationConfig(string $status): ?array {
    $config = $this->configFactory->get('status_manager_notifications.settings');
    return $config->get("status_notifications.{$status}");
  }

  /**
   * Gets recipients based on notification config.
   *
   * @param \Drupal\Core\Entity\EntityInterface $application
   *   The application entity.
   * @param array $config
   *   The notification configuration.
   *
   * @return array
   *   Array of recipients with 'email' and optionally 'phone'.
   */
  protected function getRecipients($application, array $config): array {
    $recipient_type = $config['recipient'] ?? 'customer';

    $recipients = [];

    if ($recipient_type === 'customer') {
      $memberRecipients = $this->getGroupMemberRecipients($application);
      if (!empty($memberRecipients)) {
        return $memberRecipients;
      }
      $owner = $application->getOwner();
      $phone = NULL;
      if ($owner) {
        if ($owner->hasField('field_phone_number') && !$owner->get('field_phone_number')->isEmpty()) {
          $phone = $owner->get('field_phone_number')->value;
        }
      }

      // Fall back to the chairperson / first member phone on the application.
      if (empty($phone) && $application->hasField('group_members') && !$application->get('group_members')->isEmpty()) {
        foreach ($application->get('group_members') as $member_item) {
          $member = $member_item->entity;
          if ($member && method_exists($member, 'getPhoneNumber')) {
            $member_phone = $member->getPhoneNumber();
            if (!empty($member_phone)) {
              $phone = $member_phone;
              break;
            }
          }
        }
      }

      if ($owner || $phone) {
        $email = $owner ? $owner->getEmail() : NULL;
        if (empty($email) && !empty($phone)) {
          $email = $this->lookupEmailForPhone($phone);
        }
        $recipients[] = [
          'email' => $email,
          'phone' => $phone,
          'type' => 'customer',
        ];
      }
    }
    elseif ($recipient_type === 'admin') {
      $roles = $config['admin_roles'] ?? ['reviewer'];
      $recipients = $this->getUsersByRoles($roles);
    }

    return $recipients;
  }

  /**
   * Gets one SMS/app recipient per group member phone number.
   *
   * @param \Drupal\Core\Entity\EntityInterface $application
   *   The application entity.
   *
   * @return array
   *   Array of recipients with phone numbers (and email when resolvable).
   */
  protected function getGroupMemberRecipients($application): array {
    $recipients = [];
    $seenPhones = [];

    if ($application->hasField('group_members') && !$application->get('group_members')->isEmpty()) {
      foreach ($application->get('group_members') as $member_item) {
        $member = $member_item->entity;
        if ($member && method_exists($member, 'getPhoneNumber')) {
          $phone = $member->getPhoneNumber();
          if (!empty($phone) && !isset($seenPhones[$phone])) {
            $seenPhones[$phone] = TRUE;
            $email = NULL;
            if (method_exists($member, 'getEmail')) {
              $email = $member->getEmail() ?: NULL;
            }
            if (empty($email) && $member->hasField('email') && !$member->get('email')->isEmpty()) {
              $email = $member->get('email')->value;
            }
            if (empty($email)) {
              $email = $this->lookupEmailForPhone($phone);
            }
            $recipients[] = [
              'email' => $email,
              'phone' => $phone,
              'type' => 'customer',
            ];
          }
        }
      }
    }

    return $recipients;
  }

  /**
   * Looks up a Drupal user email linked to a phone number, if any.
   */
  protected function lookupEmailForPhone(string $phone): ?string {
    $digits = preg_replace('/\D+/', '', $phone);
    if ($digits === '') {
      return NULL;
    }
    $variants = array_values(array_unique(array_filter([
      $phone,
      $digits,
      str_starts_with($digits, '254') && strlen($digits) === 12 ? ('0' . substr($digits, 3)) : NULL,
      str_starts_with($digits, '254') ? ('+' . $digits) : NULL,
      str_starts_with($digits, '0') && strlen($digits) === 10 ? ('254' . substr($digits, 1)) : NULL,
      str_starts_with($digits, '0') && strlen($digits) === 10 ? ('+254' . substr($digits, 1)) : NULL,
    ])));

    $config = $this->configFactory->get('api_auth.settings');
    $phone_field = $config->get('otp.phone_field') ?: 'field_phone_number';
    $user_storage = $this->entityTypeManager->getStorage('user');

    foreach ($variants as $candidate) {
      try {
        $uids = $user_storage->getQuery()
          ->accessCheck(FALSE)
          ->condition($phone_field, $candidate)
          ->range(0, 1)
          ->execute();
        if ($uids) {
          $user = $user_storage->load(reset($uids));
          if ($user && $user->getEmail()) {
            return strtolower(trim($user->getEmail()));
          }
        }
      }
      catch (\Throwable $e) {
        // Phone field may not exist on all installs.
      }
    }
    return NULL;
  }

  /**
   * Gets users by roles.
   *
   * @param array $roles
   *   Array of role IDs.
   *
   * @return array
   *   Array of recipients.
   */
  protected function getUsersByRoles(array $roles): array {
    $recipients = [];
    $user_storage = $this->entityTypeManager->getStorage('user');

    foreach ($roles as $role) {
      $uids = $this->entityTypeManager->getStorage('user')->getQuery()
        ->condition('status', 1)
        ->condition('roles', $role)
        ->accessCheck(FALSE)
        ->execute();

      $users = $user_storage->loadMultiple($uids);
      foreach ($users as $user) {
        $recipients[] = [
          'email' => $user->getEmail(),
          'phone' => $user->hasField('field_phone_number') ? $user->get('field_phone_number')->value : NULL,
          'type' => 'admin',
        ];
      }
    }

    return $recipients;
  }

  /**
   * Prepares notification message with token replacement.
   *
   * @param array $config
   *   The notification configuration.
   * @param \Drupal\Core\Entity\EntityInterface $application
   *   The application entity.
   * @param \Drupal\status_manager\Entity\StatusChangeInterface $status_change
   *   The status change entity.
   *
   * @return array
   *   Array with 'subject' and 'body'.
   */
  protected function prepareMessage(array $config, $application, StatusChangeInterface $status_change): array {
    $token_data = [
      'application' => $application,
      'status_change' => $status_change,
    ];

    return [
      'subject' => $this->tokenService->replace($config['subject'] ?? '', $token_data),
      'email_body' => $this->tokenService->replace($config['email_message'] ?? $config['message'] ?? '', $token_data),
      'sms_body' => $this->tokenService->replace($config['sms_message'] ?? $config['message'] ?? '', $token_data),
    ];
  }

  /**
   * Sends notification via SMS (preferred) or email.
   *
   * @param array $recipient
   *   Recipient information.
   * @param array $config
   *   Notification configuration.
   * @param array $message
   *   The prepared message.
   *
   * @return array
   *   Result with 'success' and 'message'.
   */
  protected function sendNotification(array $recipient, array $config, array $message): array {
    $prefer_sms = $this->configFactory->get('status_manager_notifications.settings')
      ->get('global.prefer_sms') ?? TRUE;

    // Try SMS first if preferred and phone available.
    if ($prefer_sms && !empty($recipient['phone'])) {
      $sms_provider = $this->getProvider('sms');
      if ($sms_provider && $sms_provider->isConfigured()) {
        return $sms_provider->sendCustomMessage($recipient['phone'], $message['sms_body']);
      }
    }

    // Fallback to email.
    if (!empty($recipient['email'])) {
      $provider_id = $recipient['type'] === 'admin' ? 'email_admin' : 'email';
      $email_provider = $this->getProvider($provider_id);

      if ($email_provider && $email_provider->isConfigured()) {
        return $email_provider->sendCustomMessage(
          $recipient['email'],
          $message['email_body'],
          ['subject' => $message['subject']]
        );
      }
    }

    return [
      'success' => FALSE,
      'message' => 'No valid contact method available',
    ];
  }

  /**
   * Notify signed-in Uwezo Fund app (inbox/FCM) of a loan status change.
   */
  protected function notifyAppPushLoanStatus(
    string $phone_number,
    ?string $email,
    string $title,
    string $body,
    string $application_id = '',
    string $status = '',
  ): bool {
    $secret = getenv('APP_PUSH_WEBHOOK_SECRET') ?: '';
    if ($secret === '') {
      return FALSE;
    }
    $phone_number = trim($phone_number);
    $email = trim((string) $email);
    if ($phone_number === '' && $email === '') {
      return FALSE;
    }
    if ($email === '' && $phone_number !== '') {
      $email = (string) ($this->lookupEmailForPhone($phone_number) ?? '');
    }

    $urls = [];
    foreach ([getenv('APP_PUSH_NOTIFY_URL'), getenv('APP_PUSH_NOTIFY_URLS')] as $raw_urls) {
      if (!is_string($raw_urls) || $raw_urls === '') {
        continue;
      }
      foreach (explode(',', $raw_urls) as $candidate) {
        $candidate = trim($candidate);
        if ($candidate !== '') {
          $urls[] = $candidate;
        }
      }
    }
    foreach ([
      'http://prod-web:3000/api/auth/app/notify',
      'http://web:3000/api/auth/app/notify',
      'http://majuu-applicant-portal:3000/api/auth/app/notify',
    ] as $peer) {
      $urls[] = $peer;
    }

    $delivered = FALSE;
    foreach (array_values(array_unique($urls)) as $url) {
      try {
        $payload = json_encode([
          'kind' => 'loan_status',
          'title' => $title !== '' ? $title : 'Uwezo Fund loan update',
          'body' => $body,
          'phone' => $phone_number !== '' ? $phone_number : NULL,
          'email' => $email !== '' ? $email : NULL,
          'meta' => [
            'applicationId' => $application_id,
            'status' => $status,
          ],
        ]);
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, TRUE);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
          'Content-Type: application/json',
          'Authorization: Bearer ' . $secret,
          'X-Uwezo-App-Push-Fanout: 1',
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        $raw = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code < 200 || $code >= 300 || !is_string($raw) || $raw === '') {
          continue;
        }
        $json = json_decode($raw, TRUE);
        if (!empty($json['delivered']) || !empty($json['ok']) || !empty($json['devices']) || !empty($json['fcmSent'])) {
          $delivered = TRUE;
        }
      }
      catch (\Throwable $e) {
        $this->logger->warning('App loan_status notify failed for @url: @err', [
          '@url' => $url,
          '@err' => $e->getMessage(),
        ]);
      }
    }
    return $delivered;
  }

  /**
   * Gets a provider instance (lazy loading with caching).
   *
   * @param string $type
   *   Provider type: 'email', 'email_admin', or 'sms'.
   *
   * @return \Drupal\status_manager_notifications\Plugin\NotificationProviderInterface|null
   *   The provider instance or NULL.
   */
  protected function getProvider(string $type): ?object {
    if (isset($this->providers[$type])) {
      return $this->providers[$type];
    }

    $config = $this->configFactory->get('status_manager_notifications.settings');
    $provider_config = $config->get("providers.{$type}") ?? [];

    // Check if provider is enabled.
    if (empty($provider_config['enabled'])) {
      $this->providers[$type] = NULL;
      return NULL;
    }

    // Determine provider ID based on type.
    $provider_id = match ($type) {
      'email' => 'api_application_email',
      'email_admin' => 'application_admin_email',
      'sms' => $this->configFactory->get('sms_providers.settings')->get('default_provider'),
      default => NULL,
    };

    if (empty($provider_id)) {
      $this->providers[$type] = NULL;
      return NULL;
    }

    try {
      $this->providers[$type] = $this->providerManager->createInstance(
        $provider_id,
        $provider_config
      );
      return $this->providers[$type];
    }
    catch (\Exception $e) {
      $this->logger->error('Failed to load provider @type: @error', [
        '@type' => $type,
        '@error' => $e->getMessage(),
      ]);
      $this->providers[$type] = NULL;
      return NULL;
    }
  }

  /**
   * Updates the status change entity with notification results.
   *
   * @param \Drupal\status_manager\Entity\StatusChangeInterface $status_change
   *   The status change entity.
   * @param array $results
   *   The notification results.
   */
  protected function updateNotificationStatus(StatusChangeInterface $status_change, array $results): void {
    $success_count = count(array_filter($results, fn($r) => $r['success']));
    $total_count = count($results);

    if ($total_count === 0) {
      $status_change->setNotificationStatus('none');
    }
    elseif ($success_count === $total_count) {
      $status_change->setNotificationStatus('sent');
    }
    elseif ($success_count > 0) {
      $status_change->setNotificationStatus('partial');
    }
    else {
      $status_change->setNotificationStatus('failed');
    }

    $log_messages = array_map(fn($r) => $r['message'] ?? 'Unknown', $results);
    $status_change->set('notification_log', implode("\n", $log_messages));
    $status_change->save();
  }

}
