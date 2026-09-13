package ke.go.uwezo.fundapp;

import android.content.BroadcastReceiver;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.text.TextUtils;
import android.widget.Toast;

public class OtpCopyReceiver extends BroadcastReceiver {
  public static final String ACTION_COPY = "ke.go.uwezo.fundapp.COPY_OTP";
  public static final String EXTRA_OTP = "otp";
  public static final String EXTRA_BODY = "body";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null) return;
    String otp = intent.getStringExtra(EXTRA_OTP);
    if (TextUtils.isEmpty(otp)) {
      otp = OtpPrefs.extractOtp(intent.getStringExtra(EXTRA_BODY));
    }
    if (TextUtils.isEmpty(otp)) {
      Toast.makeText(context, "No OTP found to copy", Toast.LENGTH_SHORT).show();
      return;
    }
    ClipboardManager clipboard =
        (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
    if (clipboard == null) return;
    clipboard.setPrimaryClip(ClipData.newPlainText("Uwezo OTP", otp));
    Toast.makeText(context, "OTP copied: " + otp, Toast.LENGTH_SHORT).show();
  }
}
