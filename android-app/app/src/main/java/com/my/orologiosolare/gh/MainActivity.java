package com.my.orologiosolare.gh;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.SystemBarStyle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.OnApplyWindowInsetsListener;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.my.orologiosolare.gh.databinding.ActivityMainBinding;

public class MainActivity extends AppCompatActivity {

    private ActivityMainBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        final int defaultSolidColor = Color.parseColor("#0D1321");

        EdgeToEdge.enable(
                this,
                SystemBarStyle.dark(defaultSolidColor),
                SystemBarStyle.dark(defaultSolidColor)
        );

        super.onCreate(savedInstanceState);
        binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        final WebView wv = binding.webview1;
        wv.getSettings().setJavaScriptEnabled(true);
        wv.getSettings().setDomStorageEnabled(true);
        wv.setOverScrollMode(View.OVER_SCROLL_NEVER);
        wv.setBackgroundColor(defaultSolidColor);

        wv.getSettings().setSupportZoom(true);
        wv.getSettings().setBuiltInZoomControls(true);
        wv.getSettings().setDisplayZoomControls(false);
        wv.getSettings().setTextZoom(100);
        wv.getSettings().setUseWideViewPort(true);

        final View layoutPadre = binding.getRoot();
        final View contentRoot = getWindow().getDecorView().findViewById(android.R.id.content);
        final int[] navBarPx = new int[]{0};

        if (Build.VERSION.SDK_INT >= 21) {
            Window window = getWindow();
            window.setStatusBarColor(defaultSolidColor);
            window.setNavigationBarColor(defaultSolidColor);
            if (Build.VERSION.SDK_INT >= 29) {
                window.setNavigationBarContrastEnforced(true);
            }
        }
        if (contentRoot != null) {
            contentRoot.setBackgroundColor(defaultSolidColor);
        }
        if (layoutPadre != null) {
            layoutPadre.setBackgroundColor(defaultSolidColor);
        }

        ViewCompat.setOnApplyWindowInsetsListener(layoutPadre, new OnApplyWindowInsetsListener() {
            @Override
            public WindowInsetsCompat onApplyWindowInsets(View v, WindowInsetsCompat insets) {
                Insets statusInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars());
                Insets navInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
                Insets imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime());

                int topPad = statusInsets.top;
                int bottomPad = Math.max(navInsets.bottom, imeInsets.bottom);
                navBarPx[0] = bottomPad;

                v.setPadding(0, topPad, 0, bottomPad);
                wv.setPadding(0, 0, 0, 0);
                return insets;
            }
        });

        wv.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void updateColors(final String colorHex) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            String safeHex = (colorHex != null) ? colorHex.trim().toUpperCase() : "";
                            String currentUrl = (wv != null && wv.getUrl() != null) ? wv.getUrl().toLowerCase() : "";

                            if (currentUrl.contains("cavanweb.com") || currentUrl.contains("cavanweb")) {
                                safeHex = "#76858C";
                            } else if (!safeHex.startsWith("#")) {
                                safeHex = "#0D1321";
                            }

                            int parsed = Color.parseColor(safeHex);
                            final int solidColor = Color.argb(255, Color.red(parsed), Color.green(parsed), Color.blue(parsed));

                            double luminance = (0.299 * Color.red(solidColor)
                                    + 0.587 * Color.green(solidColor)
                                    + 0.114 * Color.blue(solidColor)) / 255.0;
                            boolean isLightBg = luminance > 0.55;

                            SystemBarStyle barStyle = isLightBg
                                    ? SystemBarStyle.light(solidColor, solidColor)
                                    : SystemBarStyle.dark(solidColor);

                            EdgeToEdge.enable(MainActivity.this, barStyle, barStyle);

                            Window win = getWindow();
                            win.setStatusBarColor(solidColor);
                            win.setNavigationBarColor(solidColor);
                            if (Build.VERSION.SDK_INT >= 29) {
                                win.setNavigationBarContrastEnforced(true);
                            }

                            if (contentRoot != null) {
                                contentRoot.setBackgroundColor(solidColor);
                            }
                            if (layoutPadre != null) {
                                layoutPadre.setBackgroundColor(solidColor);
                            }
                        } catch (Exception e) {
                        }
                    }
                });
            }

            @JavascriptInterface
            public int getBottomInsetPx() {
                return navBarPx[0];
            }
        }, "AndroidInterface");

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && (url.contains("share") || url.startsWith("intent://") || url.contains("facebook.com") || url.contains("twitter.com"))) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        return false;
                    }
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                String js = "javascript:(function() { " +
                    "function toHex(c) { var h = Math.max(0, Math.min(255, Math.round(c))).toString(16); return h.length == 1 ? '0' + h : h; } " +
                    "function rgbToHex(rgb) { " +
                    "  var p = rgb.match(/\\d+/g); if (!p || p.length < 3) return '#0D1321'; " +
                    "  var r = parseInt(p[0], 10), g = parseInt(p[1], 10), b = parseInt(p[2], 10); " +
                    "  var maxC = Math.max(r, g, b), minC = Math.min(r, g, b); " +
                    "  if (b > r && b > g && (b - Math.min(r, g)) <= 45 && (maxC - minC) <= 55) { " +
                    "    var gray = Math.round((r + g + b) / 3); " +
                    "    return '#' + toHex(gray) + toHex(gray) + toHex(gray); " +
                    "  } " +
                    "  return '#' + toHex(r) + toHex(g) + toHex(b); " +
                    "} " +
                    "function isTransparent(bg) { " +
                    "  if (!bg || bg === 'transparent') return true; " +
                    "  var m = bg.match(/rgba?\\(([^)]+)\\)/i); " +
                    "  if (!m) return false; " +
                    "  var parts = m[1].split(','); " +
                    "  if (parts.length >= 4 && parseFloat(parts[3]) <= 0.05) return true; " +
                    "  return false; " +
                    "} " +
                    "function getMetaThemeColor() { " +
                    "  var meta = document.querySelector('meta[name=\"theme-color\"]'); " +
                    "  if (!meta) return null; " +
                    "  var c = (meta.getAttribute('content') || '').trim(); " +
                    "  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c; " +
                    "  if (/^#[0-9a-fA-F]{3}$/.test(c)) { " +
                    "    return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; " +
                    "  } " +
                    "  if (c.indexOf('rgb') !== -1 && !isTransparent(c)) return rgbToHex(c); " +
                    "  return null; " +
                    "} " +
                    "function getColorFromPoint(x, y) { " +
                    "  var el = document.elementFromPoint(x, y); " +
                    "  while (el) { " +
                    "    var bg = window.getComputedStyle(el).backgroundColor; " +
                    "    if (bg && bg.indexOf('rgb') !== -1 && !isTransparent(bg)) { " +
                    "      return rgbToHex(bg); " +
                    "    } " +
                    "    el = el.parentElement; " +
                    "  } " +
                    "  return null; " +
                    "} " +
                    "function getAverageGridColor() { " +
                    "  var w = window.innerWidth || 360; " +
                    "  var h = window.innerHeight || 640; " +
                    "  var xs = [w * 0.25, w * 0.5, w * 0.75]; " +
                    "  var ys = [12, h * 0.35, h * 0.7]; " +
                    "  var sumR = 0, sumG = 0, sumB = 0, count = 0; " +
                    "  for (var iy = 0; iy < ys.length; iy++) { " +
                    "    for (var ix = 0; ix < xs.length; ix++) { " +
                    "      var hex = getColorFromPoint(xs[ix], ys[iy]); " +
                    "      if (hex && /^#[0-9a-fA-F]{6}$/.test(hex)) { " +
                    "        sumR += parseInt(hex.substr(1, 2), 16); " +
                    "        sumG += parseInt(hex.substr(3, 2), 16); " +
                    "        sumB += parseInt(hex.substr(5, 2), 16); " +
                    "        count++; " +
                    "      } " +
                    "    } " +
                    "  } " +
                    "  if (count === 0) return null; " +
                    "  return '#' + toHex(sumR / count) + toHex(sumG / count) + toHex(sumB / count); " +
                    "} " +
                    "function ensureBottomSafeSpace() { " +
                    "  var pad = (window.AndroidInterface && AndroidInterface.getBottomInsetPx) ? AndroidInterface.getBottomInsetPx() : 0; " +
                    "  var safeSpace = Math.max(pad, 24); " +
                    "  if (document.body) { " +
                    "    document.body.style.setProperty('padding-bottom', safeSpace + 'px', 'important'); " +
                    "  } " +
                    "  var nodes = document.querySelectorAll('div, section, aside, footer, form, nav, header'); " +
                    "  for (var i = 0; i < nodes.length; i++) { " +
                    "    var el = nodes[i]; " +
                    "    var cs = window.getComputedStyle(el); " +
                    "    if (cs.position === 'fixed' || cs.position === 'sticky') { " +
                    "      var r = el.getBoundingClientRect(); " +
                    "      if (r.bottom >= window.innerHeight - 24) { " +
                    "        el.style.setProperty('margin-bottom', safeSpace + 'px', 'important'); " +
                    "      } " +
                    "    } " +
                    "  } " +
                    "} " +
                    "function scan() { " +
                    "  var ads = document.querySelectorAll('.adsbygoogle, [id^=google_ads]'); " +
                    "  for(var i=0; i<ads.length; i++) ads[i].remove(); " +
                    "  ensureBottomSafeSpace(); " +
                    "  var href = (window.location && window.location.href) ? window.location.href.toLowerCase() : ''; " +
                    "  if (href.indexOf('cavanweb.com') !== -1 || href.indexOf('cavanweb') !== -1) { " +
                    "    AndroidInterface.updateColors('#76858C'); " +
                    "    return; " +
                    "  } " +
                    "  var col = getMetaThemeColor() || getAverageGridColor() || getColorFromPoint(window.innerWidth / 2, 10) || '#0D1321'; " +
                    "  AndroidInterface.updateColors(col); " +
                    "} " +
                    "if (window.__cwScanTimer) clearInterval(window.__cwScanTimer); " +
                    "scan(); " +
                    "window.__cwScanTimer = setInterval(scan, 1500); " +
                    "})()";
                view.loadUrl(js);
            }
        });

        wv.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });

        wv.loadUrl("https://cavannastefano-sudo.github.io/OrologioSolare");

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (wv != null && wv.canGoBack()) {
                    wv.goBack();
                } else {
                    finish();
                }
            }
        });
    }
}
