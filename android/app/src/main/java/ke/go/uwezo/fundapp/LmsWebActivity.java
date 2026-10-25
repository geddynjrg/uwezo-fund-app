package ke.go.uwezo.fundapp;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * First-party WebView for live LMS (online) and cached LMS HTML shells (offline)
 * so the UX/UI matches lms.uwezo.go.ke in both modes.
 */
public class LmsWebActivity extends Activity {
  public static final String EXTRA_URL = "url";
  public static final String EXTRA_COOKIE = "cookie";
  public static final String EXTRA_OFFLINE = "offline";

  private static final int FILE_CHOOSER = 4401;

  private WebView webView;
  private ValueCallback<Uri[]> filePathCallback;
  private String baseUrl = "https://lms.uwezo.go.ke/";

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
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

    CookieManager cookies = CookieManager.getInstance();
    cookies.setAcceptCookie(true);
    cookies.setAcceptThirdPartyCookies(webView, true);

    webView.addJavascriptInterface(new OfflineBridge(), "UwezoLmsOffline");

    webView.setWebViewClient(
        new WebViewClient() {
          @Override
          public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            boolean offline = getIntent() != null && getIntent().getBooleanExtra(EXTRA_OFFLINE, false);
            if (offline) return true;
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
    boolean offline = intent.getBooleanExtra(EXTRA_OFFLINE, false) || LmsHtmlHold.offline;
    String cookieHeader = intent.getStringExtra(EXTRA_COOKIE);
    String url = intent.getStringExtra(EXTRA_URL);
    if (offline && LmsHtmlHold.html != null && !LmsHtmlHold.html.isEmpty()) {
      baseUrl =
          LmsHtmlHold.baseUrl == null || LmsHtmlHold.baseUrl.isEmpty()
              ? "https://lms.uwezo.go.ke/"
              : LmsHtmlHold.baseUrl;
      if (cookieHeader != null && !cookieHeader.isEmpty()) {
        installCookies(baseUrl, cookieHeader);
      }
      webView.loadDataWithBaseURL(baseUrl, LmsHtmlHold.html, "text/html", "UTF-8", null);
      return;
    }
    if (url == null || url.isEmpty()) return;
    installCookies(url, cookieHeader == null ? "" : cookieHeader);
    webView.loadUrl(url);
  }

  private void installCookies(String url, String cookieHeader) {
    if (cookieHeader == null || cookieHeader.isEmpty()) return;
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

  private File pageFile(String path) {
    String safe = path.replaceAll("[^a-zA-Z0-9._-]+", "_");
    if (safe.isEmpty()) safe = "root";
    File dir = new File(getFilesDir(), "lms-offline-pages");
    //noinspection ResultOfMethodCallIgnored
    dir.mkdirs();
    return new File(dir, safe + ".html");
  }

  private String readPage(String path) {
    try {
      File file = pageFile(path);
      if (!file.exists()) {
        String alt = path.endsWith("/") ? path.substring(0, path.length() - 1) : path + "/";
        file = pageFile(alt);
      }
      if (!file.exists()) return null;
      FileInputStream in = new FileInputStream(file);
      InputStreamReader reader = new InputStreamReader(in, StandardCharsets.UTF_8);
      StringBuilder sb = new StringBuilder();
      char[] buf = new char[8192];
      int n;
      while ((n = reader.read(buf)) >= 0) sb.append(buf, 0, n);
      reader.close();
      return scrubOfflineLeak(sb.toString());
    } catch (Exception e) {
      return null;
    }
  }

  /** Strip Alpine/JS bodies that otherwise render as visible text offline. */
  private static String scrubOfflineLeak(String html) {
    if (html == null || html.isEmpty()) return html;
    String doc = html;
    doc = doc.replaceAll(
        "(?is)>\\s*(?:\\{[\\s\\S]{0,4000}?filteredOptions\\s*\\(|filteredOptions\\s*\\(|get\\s+filteredOptions|found\\s*&&\\s*found\\[|COUNTY\\s+o\\s*&&|Select County|this\\.value\\)\\s*;\\s*return|if\\s*\\(\\s*!this\\.options)[\\s\\S]*?(?=<)",
        ">");
    doc = doc.replaceAll(
        "(?is)>\\s*((?:function\\s*\\(|return\\s+\\[\\]|Array\\.isArray\\(|this\\.search|this\\.options|o\\s*&&\\s*o\\[|Select County|filteredOptions)[\\s\\S]{20,12000}?)\\s*<",
        "><");
    return doc;
  }

  private class OfflineBridge {
    @JavascriptInterface
    public void openPath(String path) {
      if (path == null || path.isEmpty()) return;
      final String html = readPage(path);
      if (html == null || html.isEmpty()) return;
      runOnUiThread(
          () -> {
            LmsHtmlHold.html = html;
            LmsHtmlHold.offline = true;
            webView.loadDataWithBaseURL(baseUrl, html, "text/html", "UTF-8", null);
          });
    }
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
    LmsHtmlHold.clear();
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
