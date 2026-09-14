package ke.go.uwezo.fundapp;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class AppUpdateHelper {
  private static final String TAG = "UwezoUpdate";

  static final String[] MANIFEST_URLS = {
    "https://loans.uwezo.go.ke/uwezo-app/version.json",
    "https://loans.uwezo.go.ke/app/version.json",
  };

  static class Manifest {
    int versionCode;
    String versionName;
    String apkUrl;
    String notes;
  }

  private AppUpdateHelper() {}

  static Manifest fetchManifest() throws Exception {
    Exception last = null;
    for (String manifestUrl : MANIFEST_URLS) {
      try {
        return fetchManifest(manifestUrl);
      } catch (Exception e) {
        Log.w(TAG, "manifest fetch failed: " + manifestUrl, e);
        last = e;
      }
    }
    if (last != null) throw last;
    throw new IllegalStateException("Could not read the app update list.");
  }

  private static Manifest fetchManifest(String manifestUrl) throws Exception {
    HttpURLConnection conn = open(manifestUrl);
    conn.setRequestProperty("Accept", "application/json");
    int code = conn.getResponseCode();
    if (code < 200 || code >= 300) {
      conn.disconnect();
      throw new java.io.IOException("Update check HTTP " + code);
    }
    try (InputStream in = conn.getInputStream()) {
      byte[] buf = readAll(in);
      JSONObject json = new JSONObject(new String(buf, StandardCharsets.UTF_8));
      Manifest m = new Manifest();
      m.versionCode = json.optInt("versionCode", 0);
      m.versionName = json.optString("versionName", "");
      m.apkUrl = json.optString("apkUrl", "");
      m.notes = json.optString("notes", "");
      if (m.versionCode <= 0) {
        throw new IllegalStateException("Update list is missing versionCode.");
      }
      return m;
    } finally {
      conn.disconnect();
    }
  }

  static File downloadApk(Context context, String apkUrl) throws Exception {
    Exception last = null;
    String[] urls = {
      apkUrl,
      "https://loans.uwezo.go.ke/uwezo-app/UwezoFund.apk",
      "https://loans.uwezo.go.ke/app/UwezoFund.apk",
    };
    for (String url : urls) {
      if (url == null || url.trim().isEmpty()) continue;
      try {
        return downloadApkOnce(context, url.trim());
      } catch (Exception e) {
        Log.w(TAG, "apk download failed: " + url, e);
        last = e;
      }
    }
    if (last != null) throw last;
    throw new IllegalStateException("Could not download the app update.");
  }

  private static File downloadApkOnce(Context context, String apkUrl) throws Exception {
    File out = new File(context.getCacheDir(), "UwezoFund-update.apk");
    if (out.exists() && !out.delete()) {
      Log.w(TAG, "could not clear previous update apk");
    }
    HttpURLConnection conn = open(apkUrl);
    int code = conn.getResponseCode();
    if (code < 200 || code >= 300) {
      conn.disconnect();
      throw new java.io.IOException("Download HTTP " + code);
    }
    try (InputStream in = conn.getInputStream(); FileOutputStream fos = new FileOutputStream(out)) {
      byte[] buf = new byte[8192];
      int n;
      while ((n = in.read(buf)) >= 0) fos.write(buf, 0, n);
      fos.flush();
    } finally {
      conn.disconnect();
    }
    if (!out.isFile() || out.length() < 100_000L) {
      throw new java.io.IOException("Update file was incomplete (" + out.length() + " bytes).");
    }
    // APK is a ZIP; require local file header magic "PK".
    try (FileInputStream fis = new FileInputStream(out)) {
      byte[] magic = new byte[2];
      if (fis.read(magic) != 2 || magic[0] != 'P' || magic[1] != 'K') {
        throw new java.io.IOException("Downloaded file is not a valid APK.");
      }
    }
    return out;
  }

  private static HttpURLConnection open(String url) throws Exception {
    HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
    conn.setConnectTimeout(20000);
    conn.setReadTimeout(90000);
    conn.setInstanceFollowRedirects(true);
    conn.setRequestProperty("User-Agent", "UwezoFundApp/1.1");
    return conn;
  }

  static boolean canInstall(Context context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
    return context.getPackageManager().canRequestPackageInstalls();
  }

  static void requestInstallPermission(Context context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    Intent settings =
        new Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + context.getPackageName()));
    settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    context.startActivity(settings);
  }

  /**
   * Prefer PackageInstaller (reliable on Android 10+). Fall back to ACTION_VIEW via FileProvider.
   */
  static void promptInstall(Context context, File apk) throws Exception {
    try {
      installWithSession(context, apk);
      return;
    } catch (Exception e) {
      Log.w(TAG, "PackageInstaller session failed; trying VIEW intent", e);
    }
    Uri uri =
        FileProvider.getUriForFile(
            context, context.getPackageName() + ".fileprovider", apk);
    Intent install = new Intent(Intent.ACTION_VIEW);
    install.setDataAndType(uri, "application/vnd.android.package-archive");
    install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    if (!(context instanceof Activity)) {
      install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      install.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
      install.putExtra(Intent.EXTRA_INSTALLER_PACKAGE_NAME, context.getPackageName());
    }
    context.startActivity(install);
  }

  private static void installWithSession(Context context, File apk) throws Exception {
    PackageInstaller installer = context.getPackageManager().getPackageInstaller();
    PackageInstaller.SessionParams params =
        new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
    }
    int sessionId = installer.createSession(params);
    PackageInstaller.Session session = installer.openSession(sessionId);
    try {
      try (InputStream in = new FileInputStream(apk);
          OutputStream out = session.openWrite("uwezo-update", 0, apk.length())) {
        byte[] buf = new byte[65536];
        int n;
        while ((n = in.read(buf)) >= 0) {
          out.write(buf, 0, n);
        }
        session.fsync(out);
      }
      Intent callback = new Intent(context, MainActivity.class);
      callback.setAction("ke.go.uwezo.fundapp.UPDATE_INSTALL_RESULT");
      int flags = PendingIntent.FLAG_UPDATE_CURRENT;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        flags |= PendingIntent.FLAG_IMMUTABLE;
      }
      PendingIntent status =
          PendingIntent.getActivity(context, sessionId, callback, flags);
      session.commit(status.getIntentSender());
    } catch (Exception e) {
      try {
        session.abandon();
      } catch (Exception ignored) {
      }
      throw e;
    } finally {
      try {
        session.close();
      } catch (Exception ignored) {
      }
    }
  }

  private static byte[] readAll(InputStream in) throws Exception {
    java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
    byte[] buf = new byte[4096];
    int n;
    while ((n = in.read(buf)) >= 0) out.write(buf, 0, n);
    return out.toByteArray();
  }
}
