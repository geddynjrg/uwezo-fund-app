package ke.go.uwezo.fundapp;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class AppUpdateHelper {
  static final String MANIFEST_URL =
      "https://raw.githubusercontent.com/geddynjrg/uwezo-fund-app/main/dist-apk/version.json";

  static class Manifest {
    int versionCode;
    String versionName;
    String apkUrl;
    String notes;
  }

  private AppUpdateHelper() {}

  static Manifest fetchManifest() throws Exception {
    HttpURLConnection conn = (HttpURLConnection) new URL(MANIFEST_URL).openConnection();
    conn.setConnectTimeout(12000);
    conn.setReadTimeout(12000);
    conn.setInstanceFollowRedirects(true);
    conn.setRequestProperty("Accept", "application/json");
    conn.setRequestProperty("User-Agent", "UwezoFundApp/1.1");
    try (InputStream in = conn.getInputStream()) {
      byte[] buf = readAll(in);
      JSONObject json = new JSONObject(new String(buf, StandardCharsets.UTF_8));
      Manifest m = new Manifest();
      m.versionCode = json.optInt("versionCode", 0);
      m.versionName = json.optString("versionName", "");
      m.apkUrl = json.optString("apkUrl", "");
      m.notes = json.optString("notes", "");
      return m;
    } finally {
      conn.disconnect();
    }
  }

  static File downloadApk(Context context, String apkUrl) throws Exception {
    File out = new File(context.getCacheDir(), "UwezoFund-update.apk");
    HttpURLConnection conn = (HttpURLConnection) new URL(apkUrl).openConnection();
    conn.setConnectTimeout(20000);
    conn.setReadTimeout(60000);
    conn.setInstanceFollowRedirects(true);
    conn.setRequestProperty("User-Agent", "UwezoFundApp/1.1");
    try (InputStream in = conn.getInputStream(); FileOutputStream fos = new FileOutputStream(out)) {
      byte[] buf = new byte[8192];
      int n;
      while ((n = in.read(buf)) >= 0) fos.write(buf, 0, n);
    } finally {
      conn.disconnect();
    }
    return out;
  }

  static void promptInstall(Context context, File apk) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      if (!context.getPackageManager().canRequestPackageInstalls()) {
        Intent settings =
            new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + context.getPackageName()));
        settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(settings);
      }
    }
    Uri uri =
        FileProvider.getUriForFile(
            context, context.getPackageName() + ".fileprovider", apk);
    Intent install = new Intent(Intent.ACTION_VIEW);
    install.setDataAndType(uri, "application/vnd.android.package-archive");
    install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      install.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
      install.putExtra(Intent.EXTRA_INSTALLER_PACKAGE_NAME, context.getPackageName());
    }
    context.startActivity(install);
  }

  private static byte[] readAll(InputStream in) throws Exception {
    java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
    byte[] buf = new byte[4096];
    int n;
    while ((n = in.read(buf)) >= 0) out.write(buf, 0, n);
    return out.toByteArray();
  }
}
