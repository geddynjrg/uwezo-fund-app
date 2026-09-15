<?php

namespace App\Services;

use App\Models\MajuuApplication;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Milestone alerts for applicants: received, review, training, disbursement, rejected.
 * Sends SMS (Ebis), email when available, and Uwezo Fund app inbox/push when a phone/email is known.
 */
class MilestoneAlertService
{
    public const MILESTONE_RECEIVED = 'application_received';

    public const MILESTONE_VETTING_APPROVED = 'vetting_approved';

    public const MILESTONE_DISBURSEMENT = 'disbursement_processing';

    public const MILESTONE_REJECTED = 'application_rejected';

    public const MILESTONE_TRAINING = 'training_authorized';

    public function __construct(
        private readonly EbisSmsService $sms,
        private readonly WhatsAppNotificationService $whatsapp,
    ) {
    }

    /**
     * Map workflow status transitions to applicant-facing milestones.
     */
    public function notifyForTransition(MajuuApplication $application, string $toStatus): void
    {
        $milestone = match ($toStatus) {
            MajuuApplication::STATUS_SUBMITTED,
            MajuuApplication::STATUS_CO_REVIEW => self::MILESTONE_RECEIVED,
            MajuuApplication::STATUS_CO_APPROVED,
            MajuuApplication::STATUS_HQ_REVIEW,
            MajuuApplication::STATUS_HQ_VETTED,
            MajuuApplication::STATUS_ACCOUNTS_REVIEW,
            MajuuApplication::STATUS_ACCOUNTS_APPROVED,
            MajuuApplication::STATUS_PS_ATTESTATION => self::MILESTONE_VETTING_APPROVED,
            MajuuApplication::STATUS_APPROVED => self::MILESTONE_TRAINING,
            MajuuApplication::STATUS_OFFER_ISSUED,
            MajuuApplication::STATUS_PAYMENT_TRACKING => self::MILESTONE_DISBURSEMENT,
            MajuuApplication::STATUS_REJECTED => self::MILESTONE_REJECTED,
            default => null,
        };

        if ($milestone) {
            $this->send($application, $milestone, $toStatus);
        }
    }

    public function send(MajuuApplication $application, string $milestone, ?string $toStatus = null): void
    {
        $message = $this->messageFor($application, $milestone, $toStatus);
        if (! $message) {
            return;
        }

        $title = $this->titleFor($milestone);
        $recipients = $this->recipientsFor($application);

        if ($recipients === []) {
            Log::info('[MilestoneAlert] No member/contact recipients', [
                'application_id' => $application->id,
                'milestone' => $milestone,
            ]);

            return;
        }

        foreach ($recipients as $recipient) {
            $personalized = str_replace('{name}', $recipient['name'], $message);
            $this->deliver($recipient, $title, $personalized);
        }
    }

    /**
     * @param  array{name:string,phone:?string,email:?string}  $recipient
     */
    protected function deliver(array $recipient, string $title, string $message): void
    {
        $phone = $recipient['phone'];
        $email = $recipient['email'];

        if ($phone) {
            try {
                $this->sms->send($phone, $message);
            } catch (\Throwable $e) {
                Log::error('[MilestoneAlert] SMS failed', [
                    'error' => $e->getMessage(),
                    'phone' => $phone,
                ]);
            }

            try {
                $this->whatsapp->sendText($phone, $message);
            } catch (\Throwable $e) {
                Log::warning('[MilestoneAlert] WhatsApp failed', [
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($email) {
            try {
                Mail::raw($message, function ($mail) use ($email, $title) {
                    $mail->to($email)->subject($title);
                });
            } catch (\Throwable $e) {
                Log::warning('[MilestoneAlert] Email failed', [
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->notifyApp($phone, $email, $title, $message);
    }

    protected function notifyApp(?string $phone, ?string $email, string $title, string $message): void
    {
        if (blank($phone) && blank($email)) {
            return;
        }

        $url = rtrim((string) config('services.portal.url'), '/').'/api/auth/app/notify';
        $secret = (string) (config('services.portal.app_push_secret') ?: config('services.portal.token'));
        if (blank($secret) || blank(config('services.portal.url'))) {
            return;
        }

        try {
            Http::timeout(8)
                ->acceptJson()
                ->withToken($secret)
                ->withHeaders(['X-App-Push-Secret' => $secret])
                ->post($url, [
                    'kind' => 'loan_status',
                    'title' => $title,
                    'body' => $message,
                    'phone' => $phone,
                    'email' => $email,
                ]);
        } catch (\Throwable $e) {
            Log::warning('[MilestoneAlert] App notify failed', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * @return list<array{name:string,phone:?string,email:?string}>
     */
    protected function recipientsFor(MajuuApplication $application): array
    {
        $seen = [];
        $recipients = [];

        $add = function (?string $name, ?string $phone, ?string $email) use (&$seen, &$recipients) {
            $phone = $this->cleanPhone($phone);
            $email = $this->cleanEmail($email);
            if (! $phone && ! $email) {
                return;
            }
            $key = ($phone ?: '').'|'.($email ?: '');
            if (isset($seen[$key])) {
                return;
            }
            $seen[$key] = true;
            $recipients[] = [
                'name' => $name ?: 'member',
                'phone' => $phone,
                'email' => $email,
            ];
        };

        $portalMembers = $this->portalMembers($application);
        if ($portalMembers !== []) {
            foreach ($portalMembers as $row) {
                $add($row->name ?? null, $row->mobile ?? null, $row->email ?? null);
            }
        } else {
            $application->loadMissing('members');
            foreach ($application->members as $member) {
                $add($member->full_name, $member->mobile_number, null);
            }
        }

        $add($application->contact_name, $application->contact_phone, $application->contact_email);

        return $recipients;
    }

    /**
     * @return list<object>
     */
    protected function portalMembers(MajuuApplication $application): array
    {
        if ($application->external_source !== 'majuu_portal' || blank($application->external_id)) {
            return [];
        }

        try {
            return DB::connection('portal')
                ->table('group_members')
                ->where('applicationId', $application->external_id)
                ->get(['name', 'idNo', 'mobile', 'email'])
                ->all();
        } catch (\Throwable $e) {
            Log::warning('[MilestoneAlert] Portal member lookup failed', [
                'application_id' => $application->id,
                'error' => $e->getMessage(),
            ]);

            return [];
        }
    }

    protected function titleFor(string $milestone): string
    {
        return match ($milestone) {
            self::MILESTONE_RECEIVED => 'Wezesha Majuu application received',
            self::MILESTONE_VETTING_APPROVED => 'Wezesha Majuu application update',
            self::MILESTONE_TRAINING => 'Wezesha Majuu training authorized',
            self::MILESTONE_DISBURSEMENT => 'Wezesha Majuu disbursement update',
            self::MILESTONE_REJECTED => 'Wezesha Majuu application update',
            default => 'Wezesha Majuu application update',
        };
    }

    protected function messageFor(MajuuApplication $application, string $milestone, ?string $toStatus = null): ?string
    {
        $ref = $application->reference_number ?: ('APP-'.$application->id);
        $group = $application->group_name ?: 'your group';
        $status = $toStatus ? (MajuuApplication::statusLabels()[$toStatus] ?? $toStatus) : $application->statusLabel();

        return match ($milestone) {
            self::MILESTONE_RECEIVED => "Dear {name}, Uwezo Fund (Wezesha Majuu): application {$ref} for {$group} has been received and is awaiting review. Track it on majuu.uwezo.go.ke or the Uwezo Fund app.",
            self::MILESTONE_VETTING_APPROVED => "Dear {name}, Uwezo Fund (Wezesha Majuu): application {$ref} is now {$status}. Check majuu.uwezo.go.ke or the Uwezo Fund app for details.",
            self::MILESTONE_TRAINING => "Dear {name}, Uwezo Fund (Wezesha Majuu): training has been authorized for application {$ref}. Check majuu.uwezo.go.ke or the Uwezo Fund app.",
            self::MILESTONE_DISBURSEMENT => "Dear {name}, Uwezo Fund (Wezesha Majuu): disbursement processing has started for application {$ref}. Ensure your bank details are correct. Check the portal or Uwezo Fund app.",
            self::MILESTONE_REJECTED => "Dear {name}, Uwezo Fund (Wezesha Majuu): application {$ref} was not approved. Please check majuu.uwezo.go.ke or the Uwezo Fund app, or contact your constituency officer.",
            default => null,
        };
    }

    protected function cleanPhone(?string $phone): ?string
    {
        $phone = trim((string) $phone);

        return $phone === '' ? null : $phone;
    }

    protected function cleanEmail(?string $email): ?string
    {
        $email = strtolower(trim((string) $email));

        return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
    }
}
