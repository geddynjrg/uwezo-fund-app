package ke.go.uwezo.fundapp;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(
    name = "UwezoNative",
    permissions = {
      @Permission(
          strings = {
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_PHONE_NUMBERS
          },
          alias = "sim")
    })
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
    requestNotifyPermission();
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
  public void showOtpAlert(PluginCall call) {
    String id = call.getString("id", "");
    String title = call.getString("title", "Uwezo Fund");
    String body = call.getString("body", "");
    String kind = call.getString("kind", "otp");
    String otp = call.getString("otp", "");
    requestNotifyPermission();
    OtpAlertNotifier.show(getContext(), id, title, body, kind, otp);
    JSObject ret = new JSObject();
    ret.put("shown", true);
    boolean hasOtp = (otp != null && !otp.isEmpty()) || !OtpPrefs.extractOtp(body).isEmpty();
    ret.put("hasOtp", hasOtp);
    call.resolve(ret);
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
  public void readSimPhoneNumber(PluginCall call) {
    if (!isOnline()) {
      call.resolve(simResult(false, new JSArray(), "offline"));
      return;
    }
    if (getPermissionState("sim") != PermissionState.GRANTED) {
      requestPermissionForAlias("sim", call, "simPermissionCallback");
      return;
    }
    call.resolve(collectSimNumbers());
  }

  @PermissionCallback
  private void simPermissionCallback(PluginCall call) {
    if (!isOnline()) {
      call.resolve(simResult(false, new JSArray(), "offline"));
      return;
    }
    if (getPermissionState("sim") != PermissionState.GRANTED) {
      call.resolve(simResult(true, new JSArray(), "denied"));
      return;
    }
    call.resolve(collectSimNumbers());
  }

  @PluginMethod
  public void getVersion(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("versionCode", BuildConfig.VERSION_CODE);
    ret.put("versionName", BuildConfig.VERSION_NAME);
    call.resolve(ret);
  }

  @PluginMethod
  public void openLmsSession(PluginCall call) {
    String url = call.getString("url", "");
    String cookie = call.getString("cookie", "");
    if (url == null || url.isEmpty()) {
      call.reject("Missing LMS url");
      return;
    }
    Activity activity = getActivity();
    if (activity == null) {
      call.reject("No activity");
      return;
    }
    Intent intent = new Intent(activity, LmsWebActivity.class);
    intent.putExtra(LmsWebActivity.EXTRA_URL, url);
    intent.putExtra(LmsWebActivity.EXTRA_COOKIE, cookie == null ? "" : cookie);
    intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    activity.startActivity(intent);
    JSObject ret = new JSObject();
    ret.put("opened", true);
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
                final Activity activity = getActivity();
                final Context installCtx = activity != null ? activity : getContext();
                handler.post(
                    () -> {
                      try {
                        AppUpdateHelper.promptInstall(installCtx, apk);
                      } catch (Exception installErr) {
                        android.util.Log.e("UwezoUpdate", "promptInstall failed", installErr);
                      }
                    });
                JSObject ret = new JSObject();
                ret.put("started", true);
                ret.put("updateAvailable", true);
                ret.put("versionName", m.versionName);
                ret.put("stage", "installing");
                call.resolve(ret);
              } catch (Exception e) {
                android.util.Log.e("UwezoUpdate", "installUpdate failed", e);
                String detail = e.getMessage();
                if (detail == null || detail.trim().isEmpty()) {
                  detail = e.getClass().getSimpleName();
                }
                call.reject("Update failed: " + detail);
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

  private boolean isOnline() {
    try {
      ConnectivityManager cm =
          (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
      if (cm == null) return false;
      Network network = cm.getActiveNetwork();
      if (network == null) return false;
      NetworkCapabilities caps = cm.getNetworkCapabilities(network);
      return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    } catch (Exception ignored) {
      return false;
    }
  }

  private JSObject collectSimNumbers() {
    Set<String> found = new LinkedHashSet<>();
    Context ctx = getContext();
    try {
      SubscriptionManager subscriptions =
          (SubscriptionManager) ctx.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
      TelephonyManager telephony =
          (TelephonyManager) ctx.getSystemService(Context.TELEPHONY_SERVICE);
      if (subscriptions != null) {
        List<SubscriptionInfo> infos = subscriptions.getActiveSubscriptionInfoList();
        if (infos != null) {
          for (SubscriptionInfo info : infos) {
            int subId = info.getSubscriptionId();
            if (Build.VERSION.SDK_INT >= 33) {
              addKenyanNumber(found, subscriptions.getPhoneNumber(subId));
            }
            addKenyanNumber(found, info.getNumber());
            if (telephony != null) {
              addKenyanNumber(found, telephony.createForSubscriptionId(subId).getLine1Number());
            }
          }
        }
      }
      if (telephony != null) {
        addKenyanNumber(found, telephony.getLine1Number());
      }
    } catch (SecurityException ignored) {
      return simResult(true, new JSArray(), "denied");
    }
    JSArray numbers = new JSArray();
    for (String number : found) {
      numbers.put(number);
    }
    return simResult(true, numbers, "granted");
  }

  private void addKenyanNumber(Set<String> found, String raw) {
    if (raw == null) return;
    String digits = raw.replaceAll("\\D", "");
    if (digits.startsWith("254") && digits.length() == 12 && (digits.charAt(3) == '7' || digits.charAt(3) == '1')) {
      found.add("+" + digits);
      return;
    }
    if (digits.startsWith("0") && digits.length() == 10 && (digits.charAt(1) == '7' || digits.charAt(1) == '1')) {
      found.add("+254" + digits.substring(1));
      return;
    }
    if (digits.length() == 9 && (digits.charAt(0) == '7' || digits.charAt(0) == '1')) {
      found.add("+254" + digits);
    }
  }

  private JSObject simResult(boolean online, JSArray numbers, String permission) {
    JSObject ret = new JSObject();
    ret.put("online", online);
    ret.put("numbers", numbers);
    ret.put("permission", permission);
    return ret;
  }

  private void requestNotifyPermission() {
    try {
      if (Build.VERSION.SDK_INT < 33) return;
      Activity activity = getActivity();
      if (activity == null) return;
      if (activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
          == PackageManager.PERMISSION_GRANTED) {
        return;
      }
      activity.requestPermissions(
          new String[] {Manifest.permission.POST_NOTIFICATIONS}, 71003);
    } catch (Exception ignored) {
    }
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
