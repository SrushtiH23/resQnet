cmake_minimum_required(VERSION 3.14)
project(resqnet_cpp_engine CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Default to Release build if not set
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Choose build type: Debug or Release" FORCE)
endif()

message(STATUS "ResQNet C++ Engine Build Type: ${CMAKE_BUILD_TYPE}")

# Include directories
include_directories(include)

# Source files
set(ENGINE_SOURCES
    src/SensorProcessor.cpp
    src/FallDetector.cpp
    src/ConfidenceEngine.cpp
    src/EmergencyQueue.cpp
    src/RoutingEngine.cpp
)

# 1. Build Standalone C++ Unit Test Executable
add_executable(resqnet_tests
    tests/test_engine.cpp
    ${ENGINE_SOURCES}
)

enable_testing()
add_test(NAME CppEngineUnitTests COMMAND resqnet_tests)

# 2. Build pybind11 Python Extension Module
find_package(Python COMPONENTS Interpreter Development REQUIRED)

# Attempt to find pybind11 via CMake or Python pybind11 module
find_package(pybind11 CONFIG QUIET)

if(NOT pybind11_FOUND)
    execute_process(
        COMMAND "${Python_EXECUTABLE}" -c "import pybind11; print(pybind11.get_cmake_dir())"
        OUTPUT_VARIABLE PYBIND11_CMAKE_DIR
        OUTPUT_STRIP_TRAILING_WHITESPACE
        ERROR_QUIET
    )
    if(PYBIND11_CMAKE_DIR)
        list(APPEND CMAKE_PREFIX_PATH "${PYBIND11_CMAKE_DIR}")
        find_package(pybind11 CONFIG REQUIRED)
    endif()
endif()

if(pybind11_FOUND)
    message(STATUS "Found pybind11 version ${pybind11_VERSION}")
    pybind11_add_module(resqnet_cpp
        src/bindings.cpp
        ${ENGINE_SOURCES}
    )
    
    # Set output location to backend root so FastAPI imports resqnet_cpp cleanly
    set_target_properties(resqnet_cpp PROPERTIES
        LIBRARY_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/../backend"
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/../backend"
    )
else()
    message(WARNING "pybind11 package not found. Skipping python module build target.")
endif()
