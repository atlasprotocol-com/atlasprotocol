#!/bin/bash
set -e

RUSTFLAGS='-C link-arg=-s' cargo build --target wasm32-unknown-unknown --release
cp target/wasm32-unknown-unknown/release/*.wasm ./res/

wasm-opt target/wasm32-unknown-unknown/release/atlas_protocol.wasm -o res/atlas_protocol.wasm -Oz --enable-sign-ext
