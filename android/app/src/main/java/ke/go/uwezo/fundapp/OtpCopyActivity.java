package ke.go.uwezo.fundapp;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.widget.Toast;

public class OtpCopyActivity extends Activity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    Intent intent = getIntent();
    String otp = intent != null ? intent.getStringExtra(OtpAlertNotifier.EXTRA_OTP) : "";
    if (TextUtils.isEmpty(otp) && intent != null) {
      otp = OtpPrefs.extractOtp(intent.getStringExtra(OtpAlertNotifier.EXTRA_BODY));
    }
    if (!TextUtils.isEmpty(otp)) {
      ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
      if (clipboard != null) {
        clipboard.setPrimaryClip(ClipData.newPlainText("Uwezo OTP", otp));
      }
      Toast.makeText(this, "OTP copied: " + otp, Toast.LENGTH_LONG).show();
    } else {
      Toast.makeText(this, "No OTP found to copy", Toast.LENGTH_SHORT).show();
    }
    if (intent != null && intent.getBooleanExtra(OtpAlertNotifier.EXTRA_OPEN_APP, false)) {
      Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
      if (open != null) {
        open.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(open);
      }
    }
    finish();
  }
}
