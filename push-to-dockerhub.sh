#!/bin/bash

# 推送到Docker Hub
set -e

VERSION="v3.6.0"
DOCKER_HUB_USER="luzhipeng728"

echo "=== 推送Docker镜像到Docker Hub ==="
echo "用户: $DOCKER_HUB_USER"
echo "版本: $VERSION"
echo ""

# 服务列表
SERVICES=("main-service" "executor-service" "stats-service" "ftp-service")

for SERVICE in "${SERVICES[@]}"; do
  LOCAL_IMAGE="gcloud_server-$SERVICE:latest"
  REMOTE_IMAGE="$DOCKER_HUB_USER/gcloud-$SERVICE"

  echo "处理: $SERVICE"

  # 打标签
  docker tag $LOCAL_IMAGE $REMOTE_IMAGE:$VERSION
  docker tag $LOCAL_IMAGE $REMOTE_IMAGE:latest

  # 推送版本标签
  echo "推送 $REMOTE_IMAGE:$VERSION ..."
  docker push $REMOTE_IMAGE:$VERSION

  # 推送latest标签
  echo "推送 $REMOTE_IMAGE:latest ..."
  docker push $REMOTE_IMAGE:latest

  echo "✓ $SERVICE 推送完成"
  echo ""
done

echo "=== 所有镜像推送完成 ==="
echo ""
echo "推送的镜像:"
for SERVICE in "${SERVICES[@]}"; do
  echo "  docker pull $DOCKER_HUB_USER/gcloud-$SERVICE:$VERSION"
  echo "  docker pull $DOCKER_HUB_USER/gcloud-$SERVICE:latest"
done
echo ""
echo "Docker Hub地址:"
echo "  https://hub.docker.com/r/$DOCKER_HUB_USER"
