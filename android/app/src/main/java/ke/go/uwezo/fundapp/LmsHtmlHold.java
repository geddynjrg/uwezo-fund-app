package ke.go.uwezo.fundapp;

/** Holds large offline LMS HTML outside Intent extras (size limits). */
public final class LmsHtmlHold {
  public static volatile String html = "";
  public static volatile String baseUrl = "https://lms.uwezo.go.ke/";
  public static volatile boolean offline = false;

  private LmsHtmlHold() {}

  public static void clear() {
    html = "";
    offline = false;
  }
}
