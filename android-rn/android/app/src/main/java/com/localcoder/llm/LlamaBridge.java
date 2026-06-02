package com.localcoder.llm;

public class LlamaBridge {
    static { System.loadLibrary("llama"); }

    // Native methods implemented by libllama.so
    public static native long loadModel(String modelPath, int contextSize);
    public static native void generate(long contextPtr, String prompt, Callback callback);
    public static native void stopGeneration(long contextPtr);
    public static native void unloadModel(long contextPtr);

    public interface Callback {
        void onToken(String token);
        void onFinish();
        void onError(String error);
    }
}
