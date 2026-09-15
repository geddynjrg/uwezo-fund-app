#!/usr/bin/env python3
"""Apply Majuu member status-notify patches to the live majuu_backend tree."""

from pathlib import Path

LIVE = Path("/home/administrator/majuu_backend")
WS = Path("/home/uwezoict/work/assistive-ai-eight")


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    if new.strip() and new in text and old not in text:
        print(f"already applied: {label}")
        return
    if old not in text:
        raise SystemExit(f"block not found: {label} in {path}")
    path.write_text(text.replace(old, new, 1))
    print(f"patched: {label}")


def main() -> None:
    notify_src = WS / "majuu-portal/lib/notify/notify-application-status.ts"
    php_src = WS / "uwezo-fund-app/overlays/MilestoneAlertService.member-status.php"
    dest_notify = LIVE / "portal/web/lib/notify/notify-application-status.ts"
    dest_php = LIVE / "lms/app/Services/MilestoneAlertService.php"

    dest_notify.parent.mkdir(parents=True, exist_ok=True)
    dest_notify.write_text(notify_src.read_text())
    dest_php.write_text(php_src.read_text())
    print("copied notifier + MilestoneAlertService")

    apps = LIVE / "portal/web/lib/data/applications.ts"
    replace_once(
        apps,
        """import {
  buildGroupSubmissionConfirmationMessage,
  sendSms,
} from '@/lib/sms/sms.service';
""",
        """import { buildGroupSubmissionConfirmationMessage } from '@/lib/sms/sms.service';
import { notifyApplicationStatusChannels } from '@/lib/notify/notify-application-status';
""",
        "applications imports",
    )
    replace_once(
        apps,
        "members: Array<{ id: string; name: string; idNo: string; mobile: string }>;",
        "members: Array<{ id: string; name: string; idNo: string; mobile: string; email?: string | null }>;",
        "applications member type",
    )
    replace_once(
        apps,
        """    if (!member.mobile?.trim()) {
      console.warn(`[SMS] Skipping member ${member.name} — no mobile number`);
      failures.push(member.name);
      continue;
    }
""",
        """    if (!member.mobile?.trim() && !member.email?.trim()) {
      console.warn(`[notify] Skipping member ${member.name} — no mobile or email`);
      failures.push(member.name);
      continue;
    }
""",
        "applications skip empty contact",
    )
    replace_once(
        apps,
        '''    const result = await sendSms(member.mobile, message);
    if (process.env.APP_PUSH_ENABLED !== "false") {
      try {
        const { notifyAppUser } = await import("@/lib/push/app-push");
        await notifyAppUser({
          title: "Loan application update",
          body: message,
          kind: "loan_status",
          phone: member.mobile,
        });
      } catch (e) {
        console.warn("[push] loan status notify failed", e);
      }
    }
    if (!result.success) {
      console.error(`[SMS] Failed to notify ${member.name}:`, result.error);
      failures.push(member.name);
    }
''',
        '''    const result = await notifyApplicationStatusChannels({
      recipient: {
        name: member.name,
        phone: member.mobile,
        email: member.email,
      },
      title: 'Wezesha Majuu application update',
      emailSubject: 'Your Wezesha Majuu group application was submitted',
      message,
    });
    if (!result.sms && !result.email && !result.app) {
      console.error(`[notify] Failed to notify ${member.name} on SMS, email, and app`);
      failures.push(member.name);
    }
''',
        "applications group notify",
    )
    replace_once(
        apps,
        """  if (groupApp) {
    void triggerLmsSync(groupApp.acknowledgmentNumber);
  }

  return application;
}
""",
        """  await notifyApplicationStatusChannels({
    recipient: {
      name: application.member.name,
      phone: application.member.mobile,
      email: application.member.email,
    },
    title: 'Wezesha Majuu application submitted',
    emailSubject: 'Your Wezesha Majuu individual application was submitted',
    message: `Dear ${application.member.name}, your Uwezo Fund Wezesha Majuu individual application (Ref: ${application.acknowledgmentNumber}) has been submitted and is awaiting review. Track it on majuu.uwezo.go.ke or the Uwezo Fund app.`,
  });

  if (groupApp) {
    void triggerLmsSync(groupApp.acknowledgmentNumber);
  }

  return application;
}
""",
        "applications individual submit",
    )

    approve = LIVE / "portal/web/app/api/individual/approve-amount/route.ts"
    replace_once(
        approve,
        "import { NextResponse } from 'next/server';\n",
        "import { NextResponse } from 'next/server';\nimport { notifyApplicationStatusChannels } from '@/lib/notify/notify-application-status';\n",
        "approve-amount import",
    )
    replace_once(
        approve,
        """  return NextResponse.json({
    success: true,
    id: updated.id,
    acknowledgmentNumber: updated.acknowledgmentNumber,
    loanAmountApproved: updated.loanAmountApproved,
  });
}
""",
        """  try {
    const member = await prisma.groupMember.findUnique({
      where: { id: updated.memberId },
    });
    if (member) {
      await notifyApplicationStatusChannels({
        recipient: {
          name: member.name,
          phone: member.mobile,
          email: member.email,
        },
        title: 'Wezesha Majuu loan amount approved',
        emailSubject: 'Your Wezesha Majuu loan amount has been approved',
        message: `Dear ${member.name}, your Uwezo Fund Wezesha Majuu loan amount has been approved (Ref: ${updated.acknowledgmentNumber}). Open majuu.uwezo.go.ke or the Uwezo Fund app to review and consent to the predisbursement agreement.`,
      });
    }
  } catch (error) {
    console.warn('[approve-amount] member status notify failed', error);
  }

  return NextResponse.json({
    success: true,
    id: updated.id,
    acknowledgmentNumber: updated.acknowledgmentNumber,
    loanAmountApproved: updated.loanAmountApproved,
  });
}
""",
        "approve-amount notify",
    )

    ipn = LIVE / "portal/web/lib/payments/pesaflow-ipn.ts"
    replace_once(
        ipn,
        "import { sendSms } from '@/lib/sms/sms.service';\nimport { sendPlainEmail } from '@/lib/email/mail.service';\n",
        "import { notifyApplicationStatusChannels } from '@/lib/notify/notify-application-status';\n",
        "pesaflow import",
    )
    replace_once(
        ipn,
        """  const smsResult = await sendSms(app.member.mobile, message);
  if (smsResult.success) {
    await markPaymentSmsSent(billRefNumber);
  } else {
    console.warn('[Pesaflow IPN] Applicant SMS failed');
  }

  if (app.member.email) {
    await sendPlainEmail({
      to: app.member.email,
      subject: 'Wezesha Majuu payment received',
      text: message,
    });
  }
}
""",
        """  const result = await notifyApplicationStatusChannels({
    recipient: {
      name: app.member.name,
      phone: app.member.mobile,
      email: app.member.email,
    },
    title: 'Wezesha Majuu payment received',
    emailSubject: 'Wezesha Majuu payment received',
    message,
  });
  if (result.sms) {
    await markPaymentSmsSent(billRefNumber);
  } else {
    console.warn('[Pesaflow IPN] Applicant SMS failed');
  }
}
""",
        "pesaflow notify",
    )

    services = LIVE / "lms/config/services.php"
    replace_once(
        services,
        """    'portal' => [
        'url' => env('PORTAL_URL', 'http://majuu-applicant-portal:3000'),
        'token' => env('PORTAL_SYNC_TOKEN', env('MAJUU_LMS_SYNC_TOKEN')),
    ],
""",
        """    'portal' => [
        'url' => env('PORTAL_URL', 'http://majuu-applicant-portal:3000'),
        'token' => env('PORTAL_SYNC_TOKEN', env('MAJUU_LMS_SYNC_TOKEN')),
        'app_push_secret' => env('APP_PUSH_WEBHOOK_SECRET', env('PORTAL_SYNC_TOKEN', env('MAJUU_LMS_SYNC_TOKEN'))),
    ],
""",
        "lms services portal secret key",
    )

    compose = LIVE / "docker-compose.yml"
    replace_once(
        compose,
        "      PORTAL_URL: http://majuu-applicant-portal:3000\n",
        "      PORTAL_URL: http://majuu-applicant-portal:3000\n      APP_PUSH_WEBHOOK_SECRET: ${APP_PUSH_WEBHOOK_SECRET:-}\n",
        "compose lms app push env",
    )


if __name__ == "__main__":
    main()
