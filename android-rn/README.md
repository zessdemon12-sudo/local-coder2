# Local Coder — Android Native App

A React Native app with on-device LLM inference via llama.cpp,
plus support for OpenRouter and OpenAI-compatible API backends.

## Architecture

```
React Native (TypeScript)       ← UI layer
    │
    ├── llm-bridge.ts           ← API abstraction (OpenAI | OpenRouter | Native)
    ├── LlamaModule (Java)      ← React Native native module
    ├── LlamaBridge (JNI)       ← Java ↔ C++ bridge
    ├── libllama.so             ← llama.cpp compiled for ARM64
    └── llama.cpp (C++)         ← GGUF inference engine
```

## Quick Start (API mode)

```bash
npm install
npx react-native run-android
```

Connect to OpenRouter or any OpenAI-compatible API — no native build needed.

## Building with On-Device LLM

### Prerequisites
1. Android NDK r27+
2. Java 17+ (for JNI headers)
3. llama.cpp source

### Step 1: Build llama.cpp for Android

```bash
git clone https://github.com/ggml-org/llama.cpp
export ANDROID_NDK_HOME=/path/to/android-ndk-r27
./build-llama-android.sh ./llama.cpp $ANDROID_NDK_HOME
```

### Step 2: Build JNI bridge

```bash
cd android/app
mkdir -p build && cd build
export LLAMA_CPP_DIR=/path/to/llama.cpp
export JAVA_HOME=/path/to/jdk-17
cmake .. -DLLAMA_CPP_DIR=$LLAMA_CPP_DIR -DJAVA_HOME=$JAVA_HOME
make -j$(nproc)
```

### Step 3: Copy library

```bash
mkdir -p ../src/main/jniLibs/arm64-v8a
cp libllama_jni.so ../src/main/jniLibs/arm64-v8a/
```

### Step 4: Build APK

```bash
cd ../..
npx react-native run-android --variant=release
```

### Step 5: Place GGUF models

Copy your GGUF files to the app's model directory:
```
/storage/emulated/0/Android/data/com.localcoder/files/models/
```

Or use the app's file picker to select a model from device storage.

## Features

- **On-device LLM** — run GGUF models via llama.cpp (ARM64)
- **OpenRouter** — connect to 200+ models via API
- **OpenAI-compatible** — any OpenAI API endpoint
- **Streaming** — token-by-token response
- **Dark theme** — AMOLED-friendly UI
- **No cloud required** — fully offline capable

## Permissions

- `INTERNET` — for API mode (OpenRouter/OpenAI)
- `RECORD_AUDIO` — for STT (optional, coming soon)
- File access — for loading GGUF models
