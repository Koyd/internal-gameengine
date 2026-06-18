package dev.framework.example;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(FrameworkRuntimePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
