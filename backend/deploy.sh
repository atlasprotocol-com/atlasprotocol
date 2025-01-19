#!/bin/bash
set -e

git checkout ..
git pull

pm2 stop ecosystem.config.js

rm -rf ../package-lock.json
rm -rf ../package.json
npm ci

git checkout ..
pm2 start ecosystem.config.js
pm2 reload ecosystem.config.js