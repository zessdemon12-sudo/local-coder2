package com.localcoder.llm;

import android.os.Handler;
import android.os.Looper;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import androidx.annotation.NonNull;

public class LlamaModule extends ReactContextBaseJavaModule {
    private long contextPtr = 0;
    private volatile boolean generating = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public LlamaModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return "LlamaModule";
    }

    @ReactMethod
    public void loadModel(String modelPath, int contextSize, Promise promise) {
        new Thread(() -> {
            try {
                if (contextPtr != 0) {
                    LlamaBridge.unloadModel(contextPtr);
                    contextPtr = 0;
                }
                contextPtr = LlamaBridge.loadModel(modelPath, contextSize);
                if (contextPtr == 0) {
                    promise.reject("LOAD_ERROR", "Failed to load model: " + modelPath);
                } else {
                    promise.resolve(true);
                }
            } catch (Exception e) {
                promise.reject("LOAD_ERROR", e.getMessage());
            }
        }).start();
    }

    @ReactMethod
    public void generate(String prompt, Promise promise) {
        if (contextPtr == 0) {
            promise.reject("NO_MODEL", "Model not loaded");
            return;
        }

        generating = true;
        StringBuilder fullText = new StringBuilder();

        new Thread(() -> {
            try {
                LlamaBridge.generate(contextPtr, prompt, new LlamaBridge.Callback() {
                    @Override
                    public void onToken(String token) {
                        fullText.append(token);
                        mainHandler.post(() -> {
                            WritableMap params = Arguments.createMap();
                            params.putString("token", token);
                            getReactApplicationContext()
                                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                .emit("llama-token", params);
                        });
                    }

                    @Override
                    public void onFinish() {
                        generating = false;
                        mainHandler.post(() -> promise.resolve(fullText.toString()));
                    }

                    @Override
                    public void onError(String error) {
                        generating = false;
                        mainHandler.post(() -> promise.reject("GENERATE_ERROR", error));
                    }
                });
            } catch (Exception e) {
                generating = false;
                mainHandler.post(() -> promise.reject("GENERATE_ERROR", e.getMessage()));
            }
        }).start();
    }

    @ReactMethod
    public void stopGeneration() {
        generating = false;
        if (contextPtr != 0) {
            LlamaBridge.stopGeneration(contextPtr);
        }
    }

    @ReactMethod
    public void unloadModel() {
        stopGeneration();
        if (contextPtr != 0) {
            LlamaBridge.unloadModel(contextPtr);
            contextPtr = 0;
        }
    }
}
