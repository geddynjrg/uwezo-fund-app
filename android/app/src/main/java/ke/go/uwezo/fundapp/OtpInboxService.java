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
        String otp = OtpPrefs.extractOtp(body);
        java.util.ArrayList<String> keys = new java.util.ArrayList<>();
        if (!TextUtils.isEmpty(id)) keys.add(id);
        keys.add(fingerprint);
        if (!TextUtils.isEmpty(otp)) keys.add("otp:" + otp);
        boolean seen = false;
        for (String key : keys) {
          if (OtpPrefs.isSeen(this, key)) seen = true;
        }
        boolean recentOtp = !TextUtils.isEmpty(otp) && isRecentIso(item.optString("createdAt", ""));
        if (firstPass && !recentOtp) {
          for (String key : keys) {
            OtpPrefs.rememberSeen(this, key);
          }
          continue;
        }
        if (seen) continue;
        for (String key : keys) {
          OtpPrefs.rememberSeen(this, key);
        }
        if ("otp".equals(kind) || "loan_status".equals(kind)) {
          OtpAlertNotifier.show(this, id, title, body, kind, otp);
        }
      }
    }
    primed = true;
  }

  private boolean isRecentIso(String createdAt) {
    if (TextUtils.isEmpty(createdAt) || createdAt.length() < 19) return true;
    try {
      String normalized = createdAt.trim();
      if (normalized.endsWith("Z")) {
        normalized = normalized.substring(0, normalized.length() - 1) + "+0000";
      }
      java.text.SimpleDateFormat df = new java.text.SimpleDateFormat(
          normalized.contains(".") ? "yyyy-MM-dd'T'HH:mm:ss.SSSZ" : "yyyy-MM-dd'T'HH:mm:ssZ",
          java.util.Locale.US);
      df.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
      long created = df.parse(normalized.replace("Z", "+0000")).getTime();
      return System.currentTimeMillis() - created <= 15L * 60L * 1000L;
    } catch (Exception e) {
      return true;
    }
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

  private Notification listenerNotification() {
    // Android requires a foreground-service notification, but keep it silent
    // and out of the shade as far as the OS allows.
    return new NotificationCompat.Builder(this, CHANNEL_LISTENER)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle("Uwezo Fund")
        .setContentText("")
        .setPriority(NotificationCompat.PRIORITY_MIN)
        .setSilent(true)
        .setOngoing(true)
        .setShowWhen(false)
        .setVisibility(NotificationCompat.VISIBILITY_SECRET)
        .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_DEFERRED)
        .build();
  }

  private void ensureChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (nm == null) return;
    nm.deleteNotificationChannel(CHANNEL_LISTENER);
    NotificationChannel listen =
        new NotificationChannel(
            CHANNEL_LISTENER, "Background sync", NotificationManager.IMPORTANCE_NONE);
    listen.setDescription("Silent background sync");
    listen.setShowBadge(false);
    listen.setSound(null, null);
    listen.enableVibration(false);
    listen.enableLights(false);
    listen.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
    nm.createNotificationChannel(listen);
    OtpAlertNotifier.ensureChannel(this);
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
