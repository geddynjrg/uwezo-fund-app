package ke.go.uwezo.fundapp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(UwezoNativePlugin.class);
    super.onCreate(savedInstanceState);
    try {
      OtpInboxService.ensureStarted(this);
    } catch (Exception ignored) {
    }
  }

  @Override
  public void onStart() {
    super.onStart();
    try {
      OtpInboxService.ensureStarted(this);
    } catch (Exception ignored) {
    }
  }
}
