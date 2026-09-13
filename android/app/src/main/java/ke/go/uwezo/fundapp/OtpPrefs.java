package ke.go.uwezo.fundapp;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.List;

final class OtpPrefs {
  static final String PREFS = "uwezo.native.v1";
  static final String EMAIL = "email";
  static final String PHONE = "phone";
  static final String ORIGINS = "origins";
  static final String SEEN = "seen";
  static final String LISTENING = "listening";

  private OtpPrefs() {}

  static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  static boolean hasAccount(Context context) {
    SharedPreferences p = prefs(context);
    return p.getBoolean(LISTENING, false)
        && (!TextUtils.isEmpty(p.getString(EMAIL, ""))
            || !TextUtils.isEmpty(p.getString(PHONE, "")));
  }

  static void saveAccount(Context context, String email, String phone, List<String> origins) {
    JSONArray arr = new JSONArray();
    if (origins != null) {
      for (String origin : origins) {
        if (!TextUtils.isEmpty(origin)) arr.put(origin.replaceAll("/$", ""));
      }
    }
    prefs(context)
        .edit()
        .putString(EMAIL, email == null ? "" : email.trim())
        .putString(PHONE, phone == null ? "" : phone.trim())
        .putString(ORIGINS, arr.toString())
        .putBoolean(LISTENING, true)
        .apply();
  }

  static void clearAccount(Context context) {
    prefs(context).edit().putBoolean(LISTENING, false).apply();
  }

  static List<String> origins(Context context) {
    List<String> out = new ArrayList<>();
    try {
      JSONArray arr = new JSONArray(prefs(context).getString(ORIGINS, "[]"));
      for (int i = 0; i < arr.length(); i++) {
        String origin = arr.optString(i, "");
        if (!TextUtils.isEmpty(origin)) out.add(origin);
      }
    } catch (Exception ignored) {
    }
    if (out.isEmpty()) {
      out.add("https://loans.uwezo.go.ke");
      out.add("https://majuu.uwezo.go.ke");
    }
    return out;
  }

  static boolean isSeen(Context context, String id) {
    if (TextUtils.isEmpty(id)) return false;
    return seenIds(context).contains(id);
  }

  static boolean rememberSeen(Context context, String id) {
    if (TextUtils.isEmpty(id)) return false;
    List<String> seen = seenIds(context);
    if (seen.contains(id)) return false;
    seen.add(id);
    while (seen.size() > 300) seen.remove(0);
    JSONArray arr = new JSONArray();
    for (String row : seen) arr.put(row);
    prefs(context).edit().putString(SEEN, arr.toString()).apply();
    return true;
  }

  static List<String> seenIds(Context context) {
    List<String> seen = new ArrayList<>();
    try {
      JSONArray arr = new JSONArray(prefs(context).getString(SEEN, "[]"));
      for (int i = 0; i < arr.length(); i++) {
        String id = arr.optString(i, "");
        if (!TextUtils.isEmpty(id)) seen.add(id);
      }
    } catch (Exception ignored) {
    }
    return seen;
  }

  static String extractOtp(String text) {
    if (text == null) return "";
    java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\b(\\d{6})\\b").matcher(text);
    return m.find() ? m.group(1) : "";
  }
}
