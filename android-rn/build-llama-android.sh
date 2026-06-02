#!/bin/bash
# Build llama.cpp for Android ARM64 using Android NDK
# Prerequisites:
#   1. Android NDK r27+ (https://developer.android.com/ndk)
#   2. llama.cpp source (git clone https://github.com/ggml-org/llama.cpp)
#
# Usage: ./build-llama-android.sh [llama.cpp-path] [ndk-path]

set -e

LLAMA_CPP="${1:-./llama.cpp}"
NDK_PATH="${2:-$ANDROID_NDK_HOME}"

if [ ! -d "$LLAMA_CPP" ]; then
    echo "llama.cpp not found at $LLAMA_CPP"
    echo "Clone it: git clone https://github.com/ggml-org/llama.cpp"
    exit 1
fi

if [ ! -d "$NDK_PATH" ]; then
    echo "NDK not found at $NDK_PATH"
    echo "Set ANDROID_NDK_HOME or pass path as second argument"
    exit 1
fi

API_LEVEL=24
TOOLCHAIN="$NDK_PATH/toolchains/llvm/prebuilt/linux-x86_64"
TARGET="aarch64-linux-android$API_LEVEL"
SYSROOT="$TOOLCHAIN/sysroot"

CC="$TOOLCHAIN/bin/${TARGET}-clang"
CXX="$TOOLCHAIN/bin/${TARGET}-clang++"

mkdir -p "$LLAMA_CPP/build-android"
cd "$LLAMA_CPP/build-android"

cmake .. \
    -DCMAKE_SYSTEM_NAME=Android \
    -DCMAKE_SYSTEM_VERSION=$API_LEVEL \
    -DANDROID_ABI=arm64-v8a \
    -DANDROID_NDK="$NDK_PATH" \
    -DCMAKE_TOOLCHAIN_FILE="$NDK_PATH/build/cmake/android.toolchain.cmake" \
    -DCMAKE_C_COMPILER="$CC" \
    -DCMAKE_CXX_COMPILER="$CXX" \
    -DBUILD_SHARED_LIBS=OFF \
    -DLLAMA_STATIC=ON \
    -DLLAMA_AVX2=OFF \
    -DLLAMA_AVX=OFF \
    -DLLAMA_FMA=OFF \
    -DLLAMA_ACCELERATE=OFF

make -j$(nproc)

# Copy the static library for JNI build
cp libllama.a ../

echo ""
echo "=== Success ==="
echo "libllama.a built at $LLAMA_CPP/build-android/libllama.a"
echo ""
echo "To build the JNI module:"
echo "  cd android-rn/android/app"
echo "  mkdir build && cd build"
echo "  cmake .. -DLLAMA_CPP_DIR=$LLAMA_CPP -DJAVA_HOME=\$JAVA_HOME"
echo "  make"
echo ""
echo "Copy libllama_jni.so to:"
echo "  android-rn/android/app/src/main/jniLibs/arm64-v8a/"
