#include <jni.h>
#include <string>
#include <vector>
#include <thread>
#include <atomic>
#include "llama.h"

static struct {
    llama_model *model = nullptr;
    llama_context *ctx = nullptr;
    std::atomic<bool> stop{false};
} g_state;

extern "C" JNIEXPORT jlong JNICALL
Java_com_localcoder_llm_LlamaBridge_loadModel(JNIEnv *env, jclass, jstring jpath, jint ctxSize) {
    const char *path = env->GetStringUTFChars(jpath, nullptr);
    g_state.stop = false;

    llama_model_params model_params = llama_model_default_params();
    g_state.model = llama_load_model_from_file(path, model_params);
    env->ReleaseStringUTFChars(jpath, path);

    if (!g_state.model) return 0;

    llama_context_params ctx_params = llama_context_default_params();
    ctx_params.n_ctx = (uint32_t)ctxSize;
    g_state.ctx = llama_new_context_with_model(g_state.model, ctx_params);

    return (jlong)(uintptr_t)&g_state;
}

extern "C" JNIEXPORT void JNICALL
Java_com_localcoder_llm_LlamaBridge_generate(
    JNIEnv *env, jclass, jlong ptr, jstring jprompt, jobject jcallback
) {
    if (!g_state.ctx || !g_state.model) return;

    jclass cbClass = env->GetObjectClass(jcallback);
    jmethodID onToken = env->GetMethodID(cbClass, "onToken", "(Ljava/lang/String;)V");
    jmethodID onFinish = env->GetMethodID(cbClass, "onFinish", "()V");
    jmethodID onError = env->GetMethodID(cbClass, "onError", "(Ljava/lang/String;)V");

    const char *prompt = env->GetStringUTFChars(jprompt, nullptr);
    std::string promptStr(prompt);
    env->ReleaseStringUTFChars(jprompt, prompt);

    g_state.stop = false;

    // Tokenize prompt
    int n_tokens = (promptStr.length() + 3) / 4;
    std::vector<llama_token> tokens(n_tokens);
    n_tokens = llama_tokenize(g_state.model, promptStr.data(), promptStr.length(), tokens.data(), n_tokens, true, false);
    tokens.resize(n_tokens);

    // Generate
    for (int i = 0; i < 2048 && !g_state.stop; i++) {
        if (llama_eval(g_state.ctx, tokens.data(), tokens.size(), i == 0 ? 0 : -1) != 0) {
            jstring err = env->NewStringUTF("Evaluation failed");
            env->CallVoidMethod(jcallback, onError, err);
            env->DeleteLocalRef(err);
            return;
        }

        llama_token next = llama_sample_token(g_state.ctx, llama_sample_params_default());
        if (next == llama_token_eos(g_state.model)) break;

        std::string piece = llama_token_to_piece(g_state.ctx, next);
        tokens = { next };

        jstring jtoken = env->NewStringUTF(piece.c_str());
        env->CallVoidMethod(jcallback, onToken, jtoken);
        env->DeleteLocalRef(jtoken);
    }

    env->CallVoidMethod(jcallback, onFinish);
}

extern "C" JNIEXPORT void JNICALL
Java_com_localcoder_llm_LlamaBridge_stopGeneration(JNIEnv *, jclass, jlong) {
    g_state.stop = true;
}

extern "C" JNIEXPORT void JNICALL
Java_com_localcoder_llm_LlamaBridge_unloadModel(JNIEnv *, jclass, jlong) {
    g_state.stop = true;
    if (g_state.ctx) { llama_free(g_state.ctx); g_state.ctx = nullptr; }
    if (g_state.model) { llama_free_model(g_state.model); g_state.model = nullptr; }
}
