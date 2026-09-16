<?php

namespace Drupal\api_auth\Plugin\rest\resource;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Password\PasswordInterface;
use Drupal\Core\Session\AccountInterface;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\rest\Attribute\RestResource;
use Drupal\rest\ModifiedResourceResponse;
use Drupal\rest\Plugin\ResourceBase;
use Drupal\api_auth\Service\ApiJwtService;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\UnauthorizedHttpException;

/**
 * Provides a resource for user login with JWT token generation.
 */
#[RestResource(
  id: 'api_login',
  label: new TranslatableMarkup('API Login'),
  uri_paths: [
    'create' => '/api/v1/user/login',
  ],
)]
class ApiLoginResource extends ResourceBase {

  /**
   * The current request.
   *
   * @var \Symfony\Component\HttpFoundation\Request
   */
  protected $currentRequest;

  /**
   * The current user.
   *
   * @var \Drupal\Core\Session\AccountInterface
   */
  protected $currentUser;

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected $entityTypeManager;

  /**
   * The JWT service.
   *
   * @var \Drupal\api_auth\Service\ApiJwtService
   */
  protected $jwtService;

  /**
   * The password service.
   *
   * @var \Drupal\Core\Password\PasswordInterface
   */
  protected $passwordService;

  /**
   * Constructs a new ApiLoginResource object.
   *
   * @param array $configuration
   *   A configuration array containing plugin configuration.
   * @param string $plugin_id
   *   The plugin_id for the plugin instance.
   * @param mixed $plugin_definition
   *   The plugin implementation definition.
   * @param array $serializer_formats
   *   The available serialization formats.
   * @param \Psr\Log\LoggerInterface $logger
   *   A logger instance.
   * @param \Drupal\Core\Session\AccountInterface $current_user
   *   The current user.
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   * @param \Drupal\Core\Password\PasswordInterface $password_service
   *   The password service.
   * @param \Drupal\api_auth\Service\ApiJwtService $jwt_service
   *   The JWT service.
   * @param \Symfony\Component\HttpFoundation\Request $current_request
   *   The current request.
   */
  public function __construct(
    array $configuration,
    $plugin_id,
    $plugin_definition,
    array $serializer_formats,
    LoggerInterface $logger,
    AccountInterface $current_user,
    EntityTypeManagerInterface $entity_type_manager,
    PasswordInterface $password_service,
    ApiJwtService $jwt_service,
    Request $current_request,
  ) {
    parent::__construct($configuration, $plugin_id, $plugin_definition, $serializer_formats, $logger);
    $this->currentUser = $current_user;
    $this->entityTypeManager = $entity_type_manager;
    $this->passwordService = $password_service;
    $this->jwtService = $jwt_service;
    $this->currentRequest = $current_request;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container, array $configuration, $plugin_id, $plugin_definition) {
    return new static(
      $configuration,
      $plugin_id,
      $plugin_definition,
      $container->getParameter('serializer.formats'),
      $container->get('logger.factory')->get('api_auth'),
      $container->get('current_user'),
      $container->get('entity_type.manager'),
      $container->get('password'),
      $container->get('api_auth.jwt_service'),
      $container->get('request_stack')->getCurrentRequest()
    );
  }

  /**
   * Responds to POST requests for user login.
   *
   * @param array $data
   *   The request data containing username and password.
   *
   * @throws \Symfony\Component\HttpKernel\Exception\HttpException
   *
   * @return \Drupal\rest\ModifiedResourceResponse
   *   The HTTP response object.
   */
  public function post(?array $data = NULL) {
    if (empty($data['username']) || empty($data['password'])) {
      throw new BadRequestHttpException('Username and password are required.');
    }

    // Load the user by name or email.
    $username = $data['username'];
    $user_storage = $this->entityTypeManager->getStorage('user');

    // Try to load by username.
    $users = $user_storage->loadByProperties(['name' => $username]);
    $user = reset($users);

    // If user not found by username, try by email.
    if (!$user) {
      $users = $user_storage->loadByProperties(['mail' => $username]);
      $user = reset($users);
    }

    // Validate user and password.
    if (!$user || !$user->isActive()) {
      throw new UnauthorizedHttpException('Bearer', 'Invalid credentials.');
    }

    $stored = $user->getPassword();
    $has_password = is_string($stored) && $stored !== '';
    if ($has_password) {
      if (!$this->passwordService->check($data['password'], $stored)) {
        throw new UnauthorizedHttpException('Bearer', 'Invalid credentials.');
      }
    }
    else {
      // eCitizen SSO creates users without a password. First successful
      // username+password attempt from the app/website saves it.
      if (strlen((string) $data['password']) < 8) {
        throw new BadRequestHttpException('Password must be at least 8 characters.');
      }
      $user->setPassword($data['password']);
      $user->save();
    }

    // Generate JWT tokens.
    $tokens = $this->jwtService->generateTokens($user);

    // Prepare response data.
    $response_data = [
      'data' => [
        'access_token' => $tokens['access_token'],
        'refresh_token' => $tokens['refresh_token'],
        'expires_in' => $tokens['expires_in'],
        'token_type' => 'Bearer',
      ],
      'meta' => [
        'timestamp' => time(),
        'version' => 'v1',
      ],
    ];

    return new ModifiedResourceResponse($response_data, 200);
  }

}
