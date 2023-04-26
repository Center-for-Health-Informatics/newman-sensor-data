#!/usr/bin/env bash
NAME=`jq -r .name package.json`
VERSION=`jq -r .version package.json`
docker build --tag $NAME:$VERSION --tag $NAME:latest .
