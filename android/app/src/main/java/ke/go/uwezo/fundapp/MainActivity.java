package ke.go.uwezo.fundapp;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;

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

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    if (requestCode == LmsEmbedController.FILE_CHOOSER) {
      ValueCallback<Uri[]> cb = LmsEmbedController.get(this).takeFilePathCallback();
      if (cb != null) {
        cb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
      }
      return;
    }
    super.onActivityResult(requestCode, resultCode, data);
  }

  @Override
  public void onBackPressed() {
    // Keep embedded LMS inside the app; React Close/Menu handles leaving the module.
    super.onBackPressed();
  }

  @Override
  public void onDestroy() {
    try {
      LmsEmbedController.get(this).destroy();
    } catch (Exception ignored) {
    }
    super.onDestroy();
  }
}
