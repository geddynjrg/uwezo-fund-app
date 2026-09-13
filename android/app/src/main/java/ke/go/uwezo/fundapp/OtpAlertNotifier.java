package ke.go.uwezo.fundapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.text.TextUtils;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

final class OtpAlertNotifier {
  static final String CHANNEL_ALERT = "uwezo_otp_copy_v2";
  static final String EXTRA_OTP = "otp";
  static final String EXTRA_BODY = "body";
  static final String EXTRA_TITLE = "title";
  static final String EXTRA_OPEN_APP = "open_app";

  private OtpAlertNotifier() {}

  static void ensureChannel(Context context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm =
        (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;
    NotificationChannel alert =
        new NotificationChannel(
            CHANNEL_ALERT, "OTP codes (copy)", NotificationManager.IMPORTANCE_HIGH);
    alert.setDescription("Login and confirmation codes. Tap Copy OTP, then paste.");
    alert.enableVibration(true);
    alert.enableLights(true);
    alert.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    alert.setShowBadge(true);
    nm.createNotificationChannel(alert);
  }

  static void show(Context context, String id, String title, String body, String kind, String otp) {
    if (context == null) return;
    ensureChannel(context);
    if (TextUtils.isEmpty(otp)) {
      otp = OtpPrefs.extractOtp(body);
    }
    boolean hasOtp = !TextUtils.isEmpty(otp);
    int req = notificationId(id, otp, body);

    Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    if (open == null) open = new Intent(context, MainActivity.class);
    open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent openPi =
        PendingIntent.getActivity(
            context, req + 11, open, PendingIntent.FLAG_UPDATE_CURRENT | immutable());

    Intent copy = new Intent(context, OtpCopyActivity.class);
    copy.putExtra(EXTRA_OTP, otp);
    copy.putExtra(EXTRA_BODY, body);
    copy.putExtra(EXTRA_TITLE, title);
    copy.putExtra(EXTRA_OPEN_APP, false);
    copy.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_CLEAR_TOP
            | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
            | Intent.FLAG_ACTIVITY_NO_HISTORY);
    PendingIntent copyPi =
        PendingIntent.getActivity(
            context, req + 12, copy, PendingIntent.FLAG_UPDATE_CURRENT | immutable());

    String safeTitle = TextUtils.isEmpty(title) ? "Uwezo Fund" : title;
    String displayBody =
        hasOtp
            ? otp + " — tap Copy OTP, then paste this code where you were asked."
            : (TextUtils.isEmpty(body) ? safeTitle : body);

    NotificationCompat.Builder builder =
        new NotificationCompat.Builder(context, CHANNEL_ALERT)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(hasOtp ? safeTitle : safeTitle)
            .setContentText(displayBody)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(displayBody))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(Notification.DEFAULT_ALL)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setContentIntent(hasOtp ? copyPi : openPi)
            .setColor(0xFF006B3F)
            .setTimeoutAfter(15L * 60L * 1000L);

    if (hasOtp) {
      builder.addAction(android.R.drawable.ic_menu_save, "Copy OTP", copyPi);
    }
    builder.addAction(android.R.drawable.ic_menu_view, "Open app", openPi);

    try {
      NotificationManagerCompat.from(context).notify(req == 0 ? 71011 : req, builder.build());
    } catch (Exception ignored) {
      // POST_NOTIFICATIONS may still be denied; inbox remains in the app.
    }
  }

  private static int notificationId(String id, String otp, String body) {
    if (!TextUtils.isEmpty(otp) && otp.length() == 6) {
      try {
        return 720000 + Integer.parseInt(otp);
      } catch (NumberFormatException ignored) {
        return Math.abs(("otp|" + otp).hashCode());
      }
    }
    int hashed = Math.abs((String.valueOf(id) + "|" + String.valueOf(body)).hashCode());
    return hashed == 0 ? 71011 : hashed;
  }

  private static int immutable() {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
  }
}
