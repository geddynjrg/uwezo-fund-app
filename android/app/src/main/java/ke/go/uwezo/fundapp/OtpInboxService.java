package ke.go.uwezo.fundapp;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.text.TextUtils;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class OtpInboxService extends Service {
  public static final String CHANNEL_LISTENER = "uwezo_otp_listener";
  public static final String CHANNEL_ALERT = "uwezo_otp_alert";
  private static final int LISTENER_NOTE_ID = 71001;
  private static final int WATCHDOG_REQ = 71002;
  private static final long POLL_MS = 1500L;

  private ScheduledExecutorService executor;
  private boolean primed;

  static void ensureStarted(Context context) {
    if (!OtpPrefs.hasAccount(context)) return;
    Intent intent = new Intent(context, OtpInboxService.class);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent);
    } else {
      context.startService(intent);
    }
  }

  static void stop(Context context) {
    context.stopService(new Intent(context, OtpInboxService.class));
  }

  @Override
  public void onCreate() {
    super.onCreate();
    ensureChannels();
    Notification listening = listenerNotification();
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(
          LISTENER_NOTE_ID,
          listening,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
    } else {
      startForeground(LISTENER_NOTE_ID, listening);
    }
    scheduleWatchdog();
    executor = Executors.newSingleThreadScheduledExecutor();
    executor.scheduleWithFixedDelay(this::pollSafely, 0, POLL_MS, TimeUnit.MILLISECONDS);
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (!OtpPrefs.hasAccount(this)) {
      stopForeground(true);
      stopSelf();
      return START_NOT_STICKY;
    }
    return START_STICKY;
  }

  @Override
  public void onDestroy() {
    if (executor != null) executor.shutdownNow();
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  private void pollSafely() {
    try {
      pollOnce();
    } catch (Exception ignored) {
    }
  }

  private void pollOnce() throws Exception {
    if (!OtpPrefs.hasAccount(this)) return;
    String email = OtpPrefs.prefs(this).getString(OtpPrefs.EMAIL, "");
    String phone = OtpPrefs.prefs(this).getString(OtpPrefs.PHONE, "");
    List<String> origins = OtpPrefs.origins(this);
    boolean firstPass = !primed;
    for (String origin : origins) {
      JSONArray items = fetchInbox(origin, email, phone);
      for (int i = 0; i < items.length(); i++) {
        JSONObject item = items.optJSONObject(i);
        if (item == null) continue;
        String id = item.optString("id", "");
        String title = item.optString("title", "Uwezo Fund");
        String body = item.optString("body", "");
        String kind = item.optString("kind", "system");
        String fingerprint = kind + "|" + title + "|" + body;
        boolean freshId = OtpPrefs.rememberSeen(this, TextUtils.isEmpty(id) ? fingerprint : id);
        boolean freshFp = OtpPrefs.rememberSeen(this, fingerprint);
        if (firstPass) continue;
        if (!freshId && !freshFp) continue;
        if ("otp".equals(kind) || "loan_status".equals(kind)) {
          showAlert(id, title, body, kind);
        }
      }
    }
    primed = true;
  }

  private JSONArray fetchInbox(String origin, String email, String phone) throws Exception {
    StringBuilder url = new StringBuilder(origin.replaceAll("/$", "")).append("/api/auth/app/inbox?");
    if (!TextUtils.isEmpty(email)) {
      url.append("email=").append(URLEncoder.encode(email, "UTF-8")).append("&");
    }
    if (!TextUtils.isEmpty(phone)) {
      url.append("phone=").append(URLEncoder.encode(phone, "UTF-8"));
    }
    HttpURLConnection conn = (HttpURLConnection) new URL(url.toString()).openConnection();
    conn.setConnectTimeout(8000);
    conn.setReadTimeout(8000);
    conn.setRequestProperty("Accept", "application/json");
    conn.setRequestProperty("User-Agent", "UwezoFundApp/1.1");
    conn.setInstanceFollowRedirects(true);
    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
      StringBuilder raw = new StringBuilder();
      String line;
      while ((line = reader.readLine()) != null) raw.append(line);
      JSONObject parsed = new JSONObject(raw.toString());
      JSONArray items = parsed.optJSONArray("items");
      return items == null ? new JSONArray() : items;
    } finally {
      conn.disconnect();
    }
  }

  private void showAlert(String id, String title, String body, String kind) {
    String otp = OtpPrefs.extractOtp(body);
    Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
    if (open == null) open = new Intent(this, MainActivity.class);
    open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    int req = Math.abs((id + body).hashCode());
    PendingIntent content =
        PendingIntent.getActivity(
            this,
            req,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | immutable());

    Intent copy = new Intent(this, OtpCopyReceiver.class);
    copy.setAction(OtpCopyReceiver.ACTION_COPY);
    copy.putExtra(OtpCopyReceiver.EXTRA_OTP, otp);
    copy.putExtra(OtpCopyReceiver.EXTRA_BODY, body);
    PendingIntent copyPi =
        PendingIntent.getBroadcast(
            this,
            req + 1,
            copy,
            PendingIntent.FLAG_UPDATE_CURRENT | immutable());

    String displayBody = body;
    if ("otp".equals(kind) && !TextUtils.isEmpty(otp)) {
      displayBody = body + "\nTap Copy OTP, then paste where you were asked for the code.";
    }

    NotificationCompat.Builder builder =
        new NotificationCompat.Builder(this, CHANNEL_ALERT)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(displayBody)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(displayBody))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setContentIntent(content)
            .setColor(0xFF006B3F)
            .addAction(android.R.drawable.ic_menu_save, "Copy OTP", copyPi);

    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (nm != null) nm.notify(req == 0 ? 71011 : req, builder.build());
  }

  private Notification listenerNotification() {
    Intent open = new Intent(this, MainActivity.class);
    open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
    PendingIntent content =
        PendingIntent.getActivity(
            this, 3, open, PendingIntent.FLAG_UPDATE_CURRENT | immutable());
    return new NotificationCompat.Builder(this, CHANNEL_LISTENER)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle("Uwezo Fund")
        .setContentText("Listening for OTP and loan alerts")
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setContentIntent(content)
        .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        .build();
  }

  private void ensureChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (nm == null) return;
    NotificationChannel listen =
        new NotificationChannel(
            CHANNEL_LISTENER, "OTP listener", NotificationManager.IMPORTANCE_LOW);
    listen.setDescription("Keeps listening for login codes while the app is closed");
    listen.setShowBadge(false);
    NotificationChannel alert =
        new NotificationChannel(
            CHANNEL_ALERT, "OTP codes", NotificationManager.IMPORTANCE_HIGH);
    alert.setDescription("Login codes you can copy from the notification");
    alert.enableVibration(true);
    alert.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    nm.createNotificationChannel(listen);
    nm.createNotificationChannel(alert);
  }

  private void scheduleWatchdog() {
    Intent intent = new Intent(this, OtpInboxService.class);
    PendingIntent pi;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      pi =
          PendingIntent.getForegroundService(
              this, WATCHDOG_REQ, intent, PendingIntent.FLAG_UPDATE_CURRENT | immutable());
    } else {
      pi =
          PendingIntent.getService(
              this, WATCHDOG_REQ, intent, PendingIntent.FLAG_UPDATE_CURRENT | immutable());
    }
    AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
    if (am == null) return;
    am.setRepeating(
        AlarmManager.ELAPSED_REALTIME_WAKEUP,
        SystemClock.elapsedRealtime() + 60_000L,
        60_000L,
        pi);
  }

  private static int immutable() {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
  }
}
