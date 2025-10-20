#!/bin/bash

# 快速推送脚本 - 阿里云镜像仓库
set -e

VERSION="v3.6.0"
REGISTRY="registry.cn-hangzhou.aliyuncs.com/chatify"

echo "=== 推送Docker镜像到阿里云 ==="
echo "仓库: $REGISTRY"
echo "版本: $VERSION"
echo ""

# 服务列表
SERVICES=("main-service" "executor-service" "stats-service" "ftp-service")

for SERVICE in "${SERVICES[@]}"; do
  LOCAL_IMAGE="gcloud_server-$SERVICE:latest"
  REMOTE_IMAGE="$REGISTRY/gcloud-$SERVICE"

  echo "处理: $SERVICE"

  # 打标签
  docker tag $LOCAL_IMAGE $REMOTE_IMAGE:$VERSION
  docker tag $LOCAL_IMAGE $REMOTE_IMAGE:latest

  # 推送
  echo "推送 $REMOTE_IMAGE:$VERSION ..."
  docker push $REMOTE_IMAGE:$VERSION

  echo "推送 $REMOTE_IMAGE:latest ..."
  docker push $REMOTE_IMAGE:latest

  echo "✓ $SERVICE 推送完成"
  echo ""
done

echo "=== 所有镜像推送完成 ==="
echo ""
echo "推送的镜像:"
for SERVICE in "${SERVICES[@]}"; do
  echo "  $REGISTRY/gcloud-$SERVICE:$VERSION"
  echo "  $REGISTRY/gcloud-$SERVICE:latest"
done
