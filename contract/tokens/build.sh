#!/bin/bash
set -e

RUSTFLAGS='-C link-arg=-s' cargo build --target wasm32-unknown-unknown --release
# cp target/wasm32-unknown-unknown/release/*.wasm ./res/

wasm-opt target/wasm32-unknown-unknown/release/atBTC.wasm -o res/atBTC.wasm -Oz --enable-sign-ext

