package com.venomee.rivalsheist;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state){
        registerPlugin(RivalsSessionPlugin.class);super.onCreate(state);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
    }
}
