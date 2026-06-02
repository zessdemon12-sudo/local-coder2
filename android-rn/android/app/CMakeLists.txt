cmake_minimum_required(VERSION 3.22)
project(llama_jni C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# llama.cpp source (downloaded separately — set LLAMA_CPP_DIR)
set(LLAMA_CPP_DIR "${CMAKE_CURRENT_SOURCE_DIR}/llama.cpp" CACHE PATH "Path to llama.cpp")

add_library(llama_jni SHARED
    ${CMAKE_CURRENT_SOURCE_DIR}/jni_bridge.cpp
)

target_include_directories(llama_jni PRIVATE
    ${LLAMA_CPP_DIR}
    ${LLAMA_CPP_DIR}/common
    ${JAVA_HOME}/include
    ${JAVA_HOME}/include/linux
)

target_link_libraries(llama_jni PRIVATE
    ${LLAMA_CPP_DIR}/build/libllama.a
    pthread
    dl
    m
)
