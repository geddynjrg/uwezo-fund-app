package ke.go.uwezo.fundapp;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * LMS WebView embedded inside MainActivity under the React LMS header/menu.
 */
public final class LmsEmbedController {
  private static LmsEmbedController instance;

  private final Activity activity;
  private FrameLayout container;
  private WebView webView;
  private ValueCallback<Uri[]> filePathCallback;
  private String baseUrl = "https://lms.uwezo.go.ke/";
  private boolean offline;
  public static final int FILE_CHOOSER = 4402;

  private LmsEmbedController(Activity activity) {
    this.activity = activity;
  }

  public static synchronized LmsEmbedController get(Activity activity) {
    if (instance == null || instance.activity != activity) {
      instance = new LmsEmbedController(activity);
    }
    return instance;
  }

  public ValueCallback<Uri[]> takeFilePathCallback() {
    ValueCallback<Uri[]> cb = filePathCallback;
    filePathCallback = null;
    return cb;
  }

  public void show(
      final int left,
      final int top,
      final int width,
      final int height,
      final String url,
      final String cookie,
      final String html,
      final String base,
      final boolean offlineMode) {
    activity.runOnUiThread(
        () -> {
          ensureWebView();
          offline = offlineMode;
          if (base != null && !base.isEmpty()) baseUrl = base;
          ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) container.getLayoutParams();
          if (lp == null) {
            lp = new FrameLayout.LayoutParams(width, height);
            container.setLayoutParams(lp);
          }
          lp.width = Math.max(1, width);
          lp.height = Math.max(1, height);
          if (lp instanceof FrameLayout.LayoutParams) {
            FrameLayout.LayoutParams flp = (FrameLayout.LayoutParams) lp;
            flp.leftMargin = Math.max(0, left);
            flp.topMargin = Math.max(0, top);
          }
          container.setLayoutParams(lp);
          container.setVisibility(View.VISIBLE);
          container.bringToFront();

          if (cookie != null && !cookie.isEmpty()) {
            installCookies(baseUrl, cookie);
            if (url != null && !url.isEmpty()) installCookies(url, cookie);
          }

          if (html != null && !html.isEmpty()) {
            String clean = offlineMode ? scrubOfflineLeak(html) : html;
            LmsHtmlHold.html = clean;
            LmsHtmlHold.baseUrl = baseUrl;
            LmsHtmlHold.offline = true;
            offline = true;
            webView.loadDataWithBaseURL(baseUrl, clean, "text/html", "UTF-8", null);
          } else if (url != null && !url.isEmpty()) {
            LmsHtmlHold.clear();
            offline = false;
            webView.loadUrl(url);
          }
        });
  }

  public void setBounds(final int left, final int top, final int width, final int height) {
    activity.runOnUiThread(
        () -> {
          if (container == null) return;
          FrameLayout.LayoutParams flp = (FrameLayout.LayoutParams) container.getLayoutParams();
          if (flp == null) {
            flp = new FrameLayout.LayoutParams(width, height);
          }
          flp.leftMargin = Math.max(0, left);
          flp.topMargin = Math.max(0, top);
          flp.width = Math.max(1, width);
          flp.height = Math.max(1, height);
          container.setLayoutParams(flp);
        });
  }

  public void hide() {
    activity.runOnUiThread(
        () -> {
          if (container != null) container.setVisibility(View.GONE);
          LmsHtmlHold.clear();
        });
  }

  public void destroy() {
    activity.runOnUiThread(
        () -> {
          if (webView != null) {
            webView.destroy();
            webView = null;
          }
          if (container != null) {
            ViewGroup parent = (ViewGroup) container.getParent();
            if (parent != null) parent.removeView(container);
            container = null;
          }
        });
  }

  private void ensureWebView() {
    if (container != null && webView != null) return;
    ViewGroup root = (ViewGroup) activity.findViewById(android.R.id.content);
    container = new FrameLayout(activity);
    container.setBackgroundColor(Color.WHITE);
    FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(1, 1);
    lp.leftMargin = 0;
    lp.topMargin = 0;
    root.addView(container, lp);

    webView = new WebView(activity);
    container.addView(
        webView,
        new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

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
            if (offline) return true;
            Uri uri = request.getUrl();
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
            if (host.endsWith("uwezo.go.ke") || host.contains("govmail.ke")) return false;
            try {
              activity.startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
            }
            return true;
          }
        });
    webView.setWebChromeClient(
        new WebChromeClient() {
          @Override
          public boolean onShowFileChooser(
              WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
            if (LmsEmbedController.this.filePathCallback != null) {
              LmsEmbedController.this.filePathCallback.onReceiveValue(null);
            }
            LmsEmbedController.this.filePathCallback = filePathCallback;
            try {
              activity.startActivityForResult(fileChooserParams.createIntent(), FILE_CHOOSER);
            } catch (ActivityNotFoundException e) {
              LmsEmbedController.this.filePathCallback = null;
              return false;
            }
            return true;
          }
        });
  }

  private void installCookies(String url, String cookieHeader) {
    if (cookieHeader == null || cookieHeader.isEmpty() || url == null) return;
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
    File dir = new File(activity.getFilesDir(), "lms-offline-pages");
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

  /** Strip Alpine/JS bodies that otherwise render as visible text offline (keep offline chrome scripts). */
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
      activity.runOnUiThread(
          () -> {
            offline = true;
            webView.loadDataWithBaseURL(baseUrl, html, "text/html", "UTF-8", null);
          });
    }
  }
}
