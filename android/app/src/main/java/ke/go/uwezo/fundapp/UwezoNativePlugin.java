package ke.go.uwezo.fundapp;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "UwezoNative")
public class UwezoNativePlugin extends Plugin {

  @PluginMethod
  public void startOtpListener(PluginCall call) {
    String email = call.getString("email", "");
    String phone = call.getString("phone", "");
    List<String> origins = new ArrayList<>();
    JSArray raw = call.getArray("origins");
    if (raw != null) {
      try {
        for (int i = 0; i < raw.length(); i++) {
          origins.add(String.valueOf(raw.get(i)));
        }
      } catch (Exception ignored) {
      }
    }
    OtpPrefs.saveAccount(getContext(), email, phone, origins);
    requestBatteryExemption();
    OtpInboxService.ensureStarted(getContext());
    JSObject ret = new JSObject();
    ret.put("started", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void stopOtpListener(PluginCall call) {
    OtpPrefs.clearAccount(getContext());
    OtpInboxService.stop(getContext());
    call.resolve();
  }

  @PluginMethod
  public void copyText(PluginCall call) {
    String text = call.getString("text", "");
    ClipboardManager clipboard =
        (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
    if (clipboard != null && text != null && !text.isEmpty()) {
      clipboard.setPrimaryClip(ClipData.newPlainText("Uwezo Fund", text));
    }
    JSObject ret = new JSObject();
    ret.put("copied", text != null && !text.isEmpty());
    call.resolve(ret);
  }

  @PluginMethod
  public void getVersion(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("versionCode", BuildConfig.VERSION_CODE);
    ret.put("versionName", BuildConfig.VERSION_NAME);
    call.resolve(ret);
  }

  @PluginMethod
  public void checkForUpdate(PluginCall call) {
    new Thread(
            () -> {
              try {
                AppUpdateHelper.Manifest m = AppUpdateHelper.fetchManifest();
                boolean available = m.versionCode > BuildConfig.VERSION_CODE;
                JSObject ret = new JSObject();
                ret.put("updateAvailable", available);
                ret.put("versionCode", m.versionCode);
                ret.put("versionName", m.versionName);
                ret.put("notes", m.notes);
                ret.put("apkUrl", "");
                ret.put("currentVersionCode", BuildConfig.VERSION_CODE);
                call.resolve(ret);
              } catch (Exception e) {
                call.reject("Could not check for updates. Try again when you have a connection.");
              }
            })
        .start();
  }

  @PluginMethod
  public void installUpdate(PluginCall call) {
    new Thread(
            () -> {
              try {
                notifyStage("checking", "Checking for an update…");
                AppUpdateHelper.Manifest m = AppUpdateHelper.fetchManifest();
                if (m.versionCode <= BuildConfig.VERSION_CODE) {
                  notifyStage(
                      "up_to_date",
                      "You already have the latest version (" + BuildConfig.VERSION_NAME + ").");
                  JSObject ret = new JSObject();
                  ret.put("started", false);
                  ret.put("updateAvailable", false);
                  ret.put("versionName", BuildConfig.VERSION_NAME);
                  ret.put("stage", "up_to_date");
                  call.resolve(ret);
                  return;
                }
                if (!AppUpdateHelper.canInstall(getContext())) {
                  android.os.Handler handler =
                      new android.os.Handler(android.os.Looper.getMainLooper());
                  handler.post(
                      () -> AppUpdateHelper.requestInstallPermission(getContext()));
                  JSObject ret = new JSObject();
                  ret.put("started", false);
                  ret.put("updateAvailable", true);
                  ret.put("needsPermission", true);
                  ret.put("versionName", m.versionName);
                  ret.put("stage", "needs_permission");
                  call.resolve(ret);
                  return;
                }
                notifyStage("downloading", "Downloading version " + m.versionName + "…");
                File apk = AppUpdateHelper.downloadApk(getContext(), m.apkUrl);
                notifyStage("installing", "Installing version " + m.versionName + "…");
                android.os.Handler handler =
                    new android.os.Handler(android.os.Looper.getMainLooper());
                handler.post(() -> AppUpdateHelper.promptInstall(getContext(), apk));
                JSObject ret = new JSObject();
                ret.put("started", true);
                ret.put("updateAvailable", true);
                ret.put("versionName", m.versionName);
                ret.put("stage", "installing");
                call.resolve(ret);
              } catch (Exception e) {
                call.reject(
                    "The update could not be installed. You already have this version, or the update file is not available yet.");
              }
            })
        .start();
  }

  private void notifyStage(String stage, String message) {
    JSObject data = new JSObject();
    data.put("stage", stage);
    data.put("message", message);
    notifyListeners("updateProgress", data);
  }

  private void requestBatteryExemption() {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
      Context ctx = getContext();
      PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
      if (pm == null || pm.isIgnoringBatteryOptimizations(ctx.getPackageName())) return;
      Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
      intent.setData(Uri.parse("package:" + ctx.getPackageName()));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      ctx.startActivity(intent);
    } catch (Exception ignored) {
    }
  }
}
