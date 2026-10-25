package ke.go.uwezo.fundapp;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * First-party WebView for the live LMS so session cookies (SameSite=Lax) work
 * and every Livewire/Alpine action matches the website.
 */
public class LmsWebActivity extends Activity {
  public static final String EXTRA_URL = "url";
  public static final String EXTRA_COOKIE = "cookie";

  private static final int FILE_CHOOSER = 4401;

  private WebView webView;
  private ValueCallback<Uri[]> filePathCallback;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    webView = new WebView(this);
    setContentView(webView);

    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setLoadWithOverviewMode(true);
    settings.setUseWideViewPort(true);
    settings.setBuiltInZoomControls(true);
    settings.setDisplayZoomControls(false);
    settings.setAllowFileAccess(true);
    settings.setAllowContentAccess(true);
    settings.setMediaPlaybackRequiresUserGesture(false);

    CookieManager cookies = CookieManager.getInstance();
    cookies.setAcceptCookie(true);
    cookies.setAcceptThirdPartyCookies(webView, true);

    webView.setWebViewClient(
        new WebViewClient() {
          @Override
          public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
            if (host.endsWith("uwezo.go.ke") || host.contains("govmail.ke")) {
              return false;
            }
            try {
              startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
            }
            return true;
          }
        });

    webView.setWebChromeClient(
        new WebChromeClient() {
          @Override
          public boolean onShowFileChooser(
              WebView webView,
              ValueCallback<Uri[]> filePathCallback,
              FileChooserParams fileChooserParams) {
            if (LmsWebActivity.this.filePathCallback != null) {
              LmsWebActivity.this.filePathCallback.onReceiveValue(null);
            }
            LmsWebActivity.this.filePathCallback = filePathCallback;
            Intent intent = fileChooserParams.createIntent();
            try {
              startActivityForResult(intent, FILE_CHOOSER);
            } catch (ActivityNotFoundException e) {
              LmsWebActivity.this.filePathCallback = null;
              return false;
            }
            return true;
          }
        });

    applyAndLoad(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    applyAndLoad(intent);
  }

  private void applyAndLoad(Intent intent) {
    if (intent == null) return;
    String url = intent.getStringExtra(EXTRA_URL);
    String cookieHeader = intent.getStringExtra(EXTRA_COOKIE);
    if (url == null || url.isEmpty()) return;
    installCookies(url, cookieHeader == null ? "" : cookieHeader);
    webView.loadUrl(url);
  }

  private void installCookies(String url, String cookieHeader) {
    if (cookieHeader.isEmpty()) return;
    Uri uri = Uri.parse(url);
    if (uri.getScheme() == null || uri.getHost() == null) return;
    String origin = uri.getScheme() + "://" + uri.getHost();
    CookieManager cookies = CookieManager.getInstance();
    for (String part : cookieHeader.split(";")) {
      String trimmed = part.trim();
      if (trimmed.isEmpty() || !trimmed.contains("=")) continue;
      cookies.setCookie(origin, trimmed + "; Path=/");
      cookies.setCookie(origin, trimmed + "; Path=/; Secure");
    }
    cookies.flush();
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    if (requestCode != FILE_CHOOSER) {
      super.onActivityResult(requestCode, resultCode, data);
      return;
    }
    Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
    if (filePathCallback != null) {
      filePathCallback.onReceiveValue(result);
      filePathCallback = null;
    }
  }

  @Override
  public void onBackPressed() {
    if (webView != null && webView.canGoBack()) {
      webView.goBack();
      return;
    }
    super.onBackPressed();
  }

  @Override
  protected void onDestroy() {
    if (webView != null) {
      webView.destroy();
      webView = null;
    }
    super.onDestroy();
  }
}
