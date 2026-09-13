package ke.go.uwezo.fundapp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(UwezoNativePlugin.class);
    super.onCreate(savedInstanceState);
    OtpInboxService.ensureStarted(this);
  }
}
