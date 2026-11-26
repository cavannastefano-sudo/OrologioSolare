package com.my.orologiosolare.gh;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.SystemBarStyle;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.ColorUtils;
import androidx.core.graphics.Insets;
import androidx.core.view.OnApplyWindowInsetsListener;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.my.orologiosolare.gh.databinding.ActivityMainBinding;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private ActivityMainBinding binding;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private String pendingGeoOrigin;

    private final ActivityResultLauncher<String[]> runtimePermissionsLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
                Boolean fineGranted = result.get(Manifest.permission.ACCESS_FINE_LOCATION);
                Boolean coarseGranted = result.get(Manifest.permission.ACCESS_COARSE_LOCATION);
                boolean allowed = Boolean.TRUE.equals(fineGranted) || Boolean.TRUE.equals(coarseGranted);

                if (pendingGeoCallback != null && pendingGeoOrigin != null) {
                    pendingGeoCallback.invoke(pendingGeoOrigin, allowed, false);
                    pendingGeoCallback = null;
                    pendingGeoOrigin = null;
                }
            });

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestAppPermissionsIfNeeded() {
        List<String> toRequest = new ArrayList<>();

        if (!hasLocationPermission()) {
            toRequest.add(Manifest.permission.ACCESS_FINE_LOCATION);
            toRequest.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            toRequest.add(Manifest.permission.POST_NOTIFICATIONS);
        }

        if (!toRequest.isEmpty()) {
            runtimePermissionsLauncher.launch(toRequest.toArray(new String[0]));
        }
    }

    private boolean isLightBackground(int color) {
        return ColorUtils.calculateLuminance(color) > 0.35;
    }

    private void applySystemBarAppearance(int solidColor) {
        Window win = getWindow();
        if (win == null) return;

        boolean lightBg = isLightBackground(solidColor);

        if (Build.VERSION.SDK_INT >= 21) {
            win.setStatusBarColor(solidColor);
            win.setNavigationBarColor(solidColor);
            if (Build.VERSION.SDK_INT >= 29) {
                win.setNavigationBarContrastEnforced(false);
            }
        }

        View contentRoot = win.getDecorView().findViewById(android.R.id.content);
        if (contentRoot != null) {
            contentRoot.setBackgroundColor(solidColor);
        }

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(win, win.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(lightBg);
            controller.setAppearanceLightNavigationBars(lightBg);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            View decorView = win.getDecorView();
            int flags = decorView.getSystemUiVisibility();
            if (lightBg) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
            } else {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
            }
            decorView.setSystemUiVisibility(flags);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        final int defaultSolidColor = Color.parseColor("#0D1321");

        EdgeToEdge.enable(
                this,
                SystemBarStyle.auto(defaultSolidColor, defaultSolidColor),
                SystemBarStyle.auto(defaultSolidColor, defaultSolidColor)
        );

        super.onCreate(savedInstanceState);
        binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        final WebView wv = binding.webview1;
        wv.getSettings().setJavaScriptEnabled(true);
        wv.getSettings().setDomStorageEnabled(true);
        wv.getSettings().setGeolocationEnabled(true);
        wv.setOverScrollMode(View.OVER_SCROLL_NEVER);
        wv.setBackgroundColor(defaultSolidColor);

        wv.getSettings().setSupportZoom(true);
        wv.getSettings().setBuiltInZoomControls(true);
        wv.getSettings().setDisplayZoomControls(false);
        wv.getSettings().setTextZoom(100);
        wv.getSettings().setUseWideViewPort(true);

        final int[] topBarPx = new int[]{0};
        final int[] navBarPx = new int[]{0};

        applySystemBarAppearance(defaultSolidColor);

        ViewCompat.setOnApplyWindowInsetsListener(wv, new OnApplyWindowInsetsListener() {
            @Override
            public WindowInsetsCompat onApplyWindowInsets(View v, WindowInsetsCompat insets) {
                Insets sysBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                Insets statusInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars());
                Insets navInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
                Insets imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime());

                int topMargin = Math.max(statusInsets.top, sysBars.top);
                int bottomMargin = Math.max(Math.max(navInsets.bottom, sysBars.bottom), imeInsets.bottom);

                topBarPx[0] = topMargin;
                navBarPx[0] = bottomMargin;

                ViewGroup.LayoutParams lp = v.getLayoutParams();
                if (lp instanceof ViewGroup.MarginLayoutParams) {
                    ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) lp;
                    if (mlp.topMargin != topMargin || mlp.bottomMargin != bottomMargin) {
                        mlp.topMargin = topMargin;
                        mlp.bottomMargin = bottomMargin;
                        v.setLayoutParams(mlp);
                    }
                }
                return insets;
            }
        });

        ViewCompat.requestApplyInsets(wv);

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
                            applySystemBarAppearance(solidColor);
                        } catch (Exception e) {
                        }
                    }
                });
            }

            @JavascriptInterface
            public int getBottomInsetPx() {
                return navBarPx[0];
            }

            @JavascriptInterface
            public int getTopInsetPx() {
                return topBarPx[0];
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
                    "function scan() { " +
                    "  var ads = document.querySelectorAll('.adsbygoogle, [id^=google_ads]'); " +
                    "  for(var i=0; i<ads.length; i++) ads[i].remove(); " +
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
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false);
                } else {
                    pendingGeoOrigin = origin;
                    pendingGeoCallback = callback;
                    requestAppPermissionsIfNeeded();
                }
            }
        });

        requestAppPermissionsIfNeeded();
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
