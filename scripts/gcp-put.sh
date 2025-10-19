#!/bin/bash
# GCP Gemini API 智能密钥管理工具
# 智能管理项目：根据现有项目情况决定改名或新建，确保3个gemini项目用于生成API密钥
# 流程: 取消账单关联 → 智能项目管理 → 关联账单 → 生成Gemini密钥 → 上传FTP
# 版本: 3.4.0 - 配额测试项目复用版，避免浪费项目配额

# 仅启用 errtrace (-E) 与 nounset (-u)
set -Euo pipefail

# ===== 颜色定义 =====
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ===== 全局配置 =====
# 版本信息
VERSION="3.4.0"
LAST_UPDATED="2025-08-25"

# Gemini项目前缀词库
GEMINI_PREFIX_WORDS=(
    "gemini-alpha" "gemini-beta" "gemini-gamma" "gemini-delta" "gemini-omega"
    "gemini-azure" "gemini-cloud" "gemini-spark" "gemini-flame" "gemini-storm"
    "gemini-rapid" "gemini-swift" "gemini-quick" "gemini-flash" "gemini-boost"
    "gemini-smart" "gemini-clever" "gemini-bright" "gemini-sharp" "gemini-clear"
    "gemini-prime" "gemini-elite" "gemini-super" "gemini-mega" "gemini-hyper"
    "gemini-neo" "gemini-nova" "gemini-star" "gemini-moon" "gemini-solar"
    "gemini-tech" "gemini-data" "gemini-info" "gemini-code" "gemini-algo"
    "gemini-apex" "gemini-peak" "gemini-summit" "gemini-zenith" "gemini-crown"
    "gemini-fusion" "gemini-unity" "gemini-core" "gemini-base" "gemini-root"
    "gemini-next" "gemini-future" "gemini-modern" "gemini-advance" "gemini-grow"
)

# 通用配置
MAX_RETRY_ATTEMPTS="${MAX_RETRY:-3}"
TEMP_DIR=""  # 将在初始化时设置
TARGET_GEMINI_PROJECTS=3  # 目标Gemini项目数量（理想情况）
MIN_GEMINI_PROJECTS=1     # 最少Gemini项目数量（至少需要1个才有意义）
PREFERRED_GEMINI_PROJECTS=2  # 偏好的最少数量（有2个就很好了）

# 账单和项目配置
BILLING_ACCOUNT="${BILLING_ACCOUNT:-}"
KEY_DIR="${KEY_DIR:-./keys}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-vertex-admin}"

# 归档目录与处理模式
ARCHIVE_ROOT="${ARCHIVE_ROOT:-${KEY_DIR}_archive}"
PROCESS_MODE="all"

# 统计信息
GEMINI_KEYS_GENERATED=0
VERTEX_KEYS_GENERATED=0
LAST_UPLOAD_TXT_COUNT=0
LAST_UPLOAD_JSON_COUNT=0
LAST_UPLOAD_GEMINI_KEYS=0
LAST_ARCHIVE_DIR=""

# FTP服务器配置
FTP_SERVER="${FTP_SERVER:-82.197.94.152}"
FTP_PORT="${FTP_PORT:-21}"
FTP_USERNAME="${FTP_USERNAME:-Chatify}"
FTP_PASSWORD="${FTP_PASSWORD:-sk-chatify-MoLu154!}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR:-vip}"  # 设置为空，上传到vip目录（用户根目录）

# 无人值守模式配置
UNATTENDED_MODE=true
AUTO_CLEANUP_LOCAL=false
CURRENT_USER_EMAIL=""

# 全局变量声明
declare -a FINAL_GEMINI_PROJECTS
QUOTA_TEST_PROJECT=""  # 新增：保存配额测试项目ID

# ===== 初始化 =====
# 创建唯一的临时目录
TEMP_DIR=$(mktemp -d -t gemini_script_XXXXXX) || {
    echo "错误：无法创建临时目录"
    exit 1
}

# 确保密钥目录存在（不删除现有文件）
mkdir -p "$KEY_DIR" 2>/dev/null || {
    echo "错误：无法创建密钥目录 $KEY_DIR"
    exit 1
}

# 清理旧的密钥文件（可选：只在明确需要时清理）
# 如果需要清理，可以添加参数控制，例如：--clean-keys
if [ "${CLEAN_KEYS:-false}" = "true" ]; then
    log "INFO" "清理现有密钥文件..."
    rm -f "$KEY_DIR"/*.json 2>/dev/null || true
    rm -f "$KEY_DIR"/*.txt 2>/dev/null || true
fi
chmod 700 "$KEY_DIR" 2>/dev/null || true

# 开始计时
SECONDS=0

# ===== 日志函数（带颜色） =====
log() { 
    local level="${1:-INFO}"
    local msg="${2:-}"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        "INFO")     echo -e "${CYAN}[${timestamp}] [INFO] ${msg}${NC}" >&2 ;;
        "SUCCESS")  echo -e "${GREEN}[${timestamp}] [SUCCESS] ${msg}${NC}" >&2 ;;
        "WARN")     echo -e "${YELLOW}[${timestamp}] [WARN] ${msg}${NC}" >&2 ;;
        "ERROR")    echo -e "${RED}[${timestamp}] [ERROR] ${msg}${NC}" >&2 ;;
        *)          echo "[${timestamp}] [${level}] ${msg}" >&2 ;;
    esac
}

# ===== 处理模式辅助函数 =====
set_process_mode() {
    local input_mode="${1:-all}"
    local normalized
    normalized=$(echo "$input_mode" | tr '[:upper:]' '[:lower:]')

    case "$normalized" in
        gemini|vertex|all)
            PROCESS_MODE="$normalized"
            ;;
        *)
            echo "不支持的模式: ${input_mode}" >&2
            echo "请使用: gemini | vertex | all" >&2
            exit 1
            ;;
    esac
}

should_process_gemini() {
    [[ "$PROCESS_MODE" = "gemini" || "$PROCESS_MODE" = "all" ]]
}

should_process_vertex() {
    [[ "$PROCESS_MODE" = "vertex" || "$PROCESS_MODE" = "all" ]]
}

# ===== 错误处理 =====
handle_error() {
    local exit_code=$?
    local line_no=$1
    
    # 忽略某些非严重错误
    case $exit_code in
        141)  # SIGPIPE
            return 0
            ;;
        130)  # Ctrl+C
            log "INFO" "用户中断操作"
            exit 130
            ;;
    esac
    
    # 记录错误
    log "ERROR" "在第 ${line_no} 行发生错误 (退出码 ${exit_code})"
    
    # 严重错误才终止
    if [ $exit_code -gt 1 ]; then
        log "ERROR" "发生严重错误，请检查日志"
        return $exit_code
    else
        log "WARN" "发生非严重错误，继续执行"
        return 0
    fi
}

# 设置错误处理
trap 'handle_error $LINENO' ERR

# ===== 清理函数 =====
cleanup_resources() {
    local exit_code=$?
    
    # 清理临时文件
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR" 2>/dev/null || true
        log "INFO" "已清理临时文件"
    fi
    
    # 如果是正常退出，显示完成信息
    if [ $exit_code -eq 0 ]; then
        echo -e "\n${GREEN}${BOLD}Gemini API 密钥管理流程执行完成！${NC}" >&2
        local duration=$((SECONDS / 60))
        local remaining=$((SECONDS % 60))
        echo -e "${CYAN}总耗时: ${duration}分${remaining}秒${NC}" >&2
    fi
}

# 设置退出处理
trap cleanup_resources EXIT

# ===== 工具函数 =====

# 生成随机Gemini项目前缀
generate_random_gemini_prefix() {
    local word_count=${#GEMINI_PREFIX_WORDS[@]}
    local random_index
    
    # 生成随机索引
    if command -v openssl &>/dev/null; then
        random_index=$(( $(openssl rand 2 | od -An -tu2) % word_count ))
    else
        random_index=$(( RANDOM % word_count ))
    fi
    
    echo "${GEMINI_PREFIX_WORDS[$random_index]}"
}

# 修复：改进的重试函数，区分是否需要输出
retry() {
    local max_attempts="$MAX_RETRY_ATTEMPTS"
    local attempt=1
    local delay
    
    while [ $attempt -le $max_attempts ]; do
        # 直接执行命令，不捕获输出用于返回
        if "$@" >/dev/null 2>&1; then
            return 0
        fi
        
        local cmd_exit_code=$?
        
        # 捕获错误输出用于日志
        local cmd_output
        cmd_output=$("$@" 2>&1) || true
        
        # 检查是否是权限或配额相关错误（不适合重试）
        if echo "$cmd_output" | grep -qi "permission\|denied\|forbidden\|quota\|billing\|limit\|exceeded"; then
            log "ERROR" "权限或配额错误，停止重试"
            return $cmd_exit_code
        fi
        
        if [ $attempt -ge $max_attempts ]; then
            log "ERROR" "命令在 ${max_attempts} 次尝试后失败: $*"
            log "ERROR" "最后错误: $cmd_output"
            return $cmd_exit_code
        fi
        
        delay=$(( attempt * 15 + RANDOM % 10 ))
        log "WARN" "重试 ${attempt}/${max_attempts}: $* (等待 ${delay}s)"
        sleep $delay
        attempt=$((attempt + 1)) || true
    done
}

# 静默重试函数（用于不需要详细输出的命令）
retry_silent() {
    local max_attempts="$MAX_RETRY_ATTEMPTS"
    local attempt=1
    local delay
    
    while [ $attempt -le $max_attempts ]; do
        if "$@" >/dev/null 2>&1; then
            return 0
        fi
        
        local cmd_exit_code=$?
        
        if [ $attempt -ge $max_attempts ]; then
            return $cmd_exit_code
        fi
        
        delay=$(( attempt * 5 + RANDOM % 5 ))
        sleep $delay
        attempt=$((attempt + 1)) || true
    done
}

# 检查命令是否存在
require_cmd() { 
    if ! command -v "$1" &>/dev/null; then
        log "ERROR" "缺少依赖: $1"
        exit 1
    fi
}

# 检查并安装FTP客户端
check_ftp_client() {
    # 检查是否有可用的FTP客户端
    if command -v ftp &>/dev/null; then
        return 0
    elif command -v lftp &>/dev/null; then
        return 0
    elif command -v ncftp &>/dev/null; then
        return 0
    elif command -v curl &>/dev/null; then
        return 0
    else
        log "WARN" "未找到FTP客户端，尝试安装..."
        if command -v apt-get &>/dev/null; then
            apt-get update -qq && apt-get install -y ftp lftp curl 2>/dev/null || true
        elif command -v yum &>/dev/null; then
            yum install -y ftp lftp curl 2>/dev/null || true
        elif command -v brew &>/dev/null; then
            brew install lftp curl 2>/dev/null || true
        fi
        
        # 再次检查
        if ! (command -v ftp &>/dev/null || command -v lftp &>/dev/null || command -v curl &>/dev/null); then
            log "ERROR" "无法安装FTP客户端"
            return 1
        fi
    fi
}

# 生成随机4位数字
generate_random_4digits() {
    if command -v openssl &>/dev/null; then
        printf "%04d" $(($(openssl rand 2 | od -An -tu2) % 10000))
    else
        printf "%04d" $(( RANDOM % 10000 ))
    fi
}

# 获取当前用户邮箱
get_current_user_email() {
    if [ -n "$CURRENT_USER_EMAIL" ]; then
        echo "$CURRENT_USER_EMAIL"
        return 0
    fi
    
    local email
    email=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -n 1)
    
    if [ -n "$email" ]; then
        CURRENT_USER_EMAIL="$email"
        echo "$email"
        return 0
    else
        log "ERROR" "无法获取当前用户邮箱"
        return 1
    fi
}

# 生成Gemini API密钥文件名（TXT格式）
generate_gemini_filename() {
    local user_email
    user_email=$(get_current_user_email) || return 1
    echo "${user_email}.txt"
}

# 生成Vertex服务账号密钥文件名（JSON格式）
generate_vertex_filename() {
    local project_id="${1:-}"
    local user_email
    local random_digits

    user_email=$(get_current_user_email) || return 1
    random_digits=$(generate_random_4digits)

    # 如果提供了project_id，将其包含在文件名中以确保唯一性
    if [ -n "$project_id" ]; then
        # 提取项目ID的最后6个字符作为唯一标识
        local project_suffix="${project_id: -6}"
        echo "${user_email}_${project_suffix}_${random_digits}.json"
    else
        echo "${user_email}${random_digits}.json"
    fi
}

# 生成唯一后缀
unique_suffix() { 
    if command -v uuidgen &>/dev/null; then
        uuidgen | tr -d '-' | cut -c1-6 | tr '[:upper:]' '[:lower:]'
    else
        echo "$(date +%s%N 2>/dev/null || date +%s)${RANDOM}" | sha256sum | cut -c1-6
    fi
}

# 进度条显示
show_progress() {
    local completed="${1:-0}"
    local total="${2:-1}"
    
    # 参数验证
    if [ "$total" -le 0 ]; then
        return
    fi
    
    # 确保不超过总数
    if [ "$completed" -gt "$total" ]; then
        completed=$total
    fi
    
    # 计算百分比
    local percent=$((completed * 100 / total))
    local bar_length=50
    local filled=$((percent * bar_length / 100))
    
    # 生成进度条 - 使用安全的方式循环
    local bar=""
    local i=0
    while [ $i -lt $filled ]; do
        bar+="█"
        i=$((i + 1)) || true
    done
    
    i=$filled
    while [ $i -lt $bar_length ]; do
        bar+="░"
        i=$((i + 1)) || true
    done
    
    # 显示进度
    printf "\r[%s] %3d%% (%d/%d)" "$bar" "$percent" "$completed" "$total" >&2
    
    # 完成时换行
    if [ "$completed" -eq "$total" ]; then
        echo >&2
    fi
}

# JSON解析（改进版本）
parse_json() {
    local json="$1"
    local field="$2"
    
    if [ -z "$json" ]; then
        log "ERROR" "JSON解析: 输入为空"
        return 1
    fi
    
    # 尝试使用 jq（如果可用）
    if command -v jq &>/dev/null; then
        local result
        result=$(echo "$json" | jq -r "$field" 2>/dev/null)
        if [ -n "$result" ] && [ "$result" != "null" ]; then
            echo "$result"
            return 0
        fi
    fi
    
    # 备用方法 - 针对keyString专门处理
    if [ "$field" = ".keyString" ]; then
        local value
        # 尝试多种模式匹配
        value=$(echo "$json" | grep -o '"keyString":"[^"]*"' | sed 's/"keyString":"//;s/"$//' | head -n 1)
        
        if [ -z "$value" ]; then
            # 第二种尝试
            value=$(echo "$json" | grep -o '"keyString" *: *"[^"]*"' | sed 's/"keyString" *: *"//;s/"$//' | head -n 1)
        fi
        
        if [ -n "$value" ]; then
            echo "$value"
            return 0
        fi
    fi
    
    # 通用字段处理
    local field_name
    field_name=$(echo "$field" | sed 's/^\.//; s/\[[0-9]*\]//g')
    local value
    value=$(echo "$json" | grep -o "\"$field_name\":[^,}]*" | sed "s/\"$field_name\"://;s/\"//g;s/^ *//;s/ *$//" | head -n 1)
    
    if [ -n "$value" ] && [ "$value" != "null" ]; then
        echo "$value"
        return 0
    fi
    
    log "WARN" "JSON解析: 无法提取字段 $field"
    return 1
}

# FTP上传文件
upload_to_ftp() {
    local local_file="$1"
    local remote_filename="${2:-$(basename "$local_file")}"
    
    if [ ! -f "$local_file" ]; then
        log "ERROR" "本地文件不存在: $local_file"
        return 1
    fi
    
    log "INFO" "上传文件到FTP服务器: $remote_filename"
    
    # 构建FTP路径，如果FTP_REMOTE_DIR为空则上传到根目录
    local ftp_path=""
    if [ -n "$FTP_REMOTE_DIR" ]; then
        ftp_path="${FTP_REMOTE_DIR}/"
    fi
    
    # 优先使用 curl (最兼容)
    if command -v curl &>/dev/null; then
        if curl -T "$local_file" \
            "ftp://${FTP_USERNAME}:${FTP_PASSWORD}@${FTP_SERVER}:${FTP_PORT}/${ftp_path}${remote_filename}" \
            --connect-timeout 30 \
            --max-time 300 \
            --silent --show-error; then
            log "SUCCESS" "文件上传成功: $remote_filename"
            return 0
        else
            log "ERROR" "curl上传失败，尝试其他方法"
        fi
    fi
    
    # 备用方法：lftp
    if command -v lftp &>/dev/null; then
        local lftp_cmd="set ftp:ssl-allow no; open -u ${FTP_USERNAME},${FTP_PASSWORD} ${FTP_SERVER}:${FTP_PORT};"
        if [ -n "$FTP_REMOTE_DIR" ]; then
            lftp_cmd="${lftp_cmd} cd '${FTP_REMOTE_DIR}';"
        fi
        lftp_cmd="${lftp_cmd} put '${local_file}' -o '${remote_filename}'; quit"
        
        if lftp -c "$lftp_cmd" 2>/dev/null; then
            log "SUCCESS" "文件上传成功: $remote_filename"
            return 0
        else
            log "ERROR" "lftp上传失败"
        fi
    fi
    
    # 最后尝试：传统ftp
    if command -v ftp &>/dev/null; then
        local ftp_commands="open ${FTP_SERVER} ${FTP_PORT}
user ${FTP_USERNAME} ${FTP_PASSWORD}
binary"
        if [ -n "$FTP_REMOTE_DIR" ]; then
            ftp_commands="${ftp_commands}
cd '${FTP_REMOTE_DIR}'"
        fi
        ftp_commands="${ftp_commands}
put '${local_file}' '${remote_filename}'
quit"
        
        echo "$ftp_commands" | ftp -n > /dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            log "SUCCESS" "文件上传成功: $remote_filename"
            return 0
        else
            log "ERROR" "ftp上传失败"
        fi
    fi
    
    log "ERROR" "所有FTP上传方法都失败了"
    return 1
}

# 检查API密钥创建权限
check_api_key_permissions() {
    local project_id="$1"
    
    log "INFO" "检查API密钥创建权限..."
    
    # 检查是否有必要的IAM权限
    local required_permissions=(
        "serviceusage.services.enable"
        "apikeys.keys.create"
        "resourcemanager.projects.get"
    )
    
    for permission in "${required_permissions[@]}"; do
        if ! gcloud projects test-iam-permissions "$project_id" --permissions="$permission" --quiet >/dev/null 2>&1; then
            log "WARN" "可能缺少权限: $permission"
        fi
    done
    
    return 0
}

# 检查环境
check_env() {
    log "INFO" "检查环境配置..."
    
    # 检查必要命令
    require_cmd gcloud
    
    # 检查 gcloud 配置
    if ! gcloud config list account --quiet &>/dev/null; then
        log "ERROR" "请先运行 'gcloud init' 初始化"
        exit 1
    fi
    
    # 检查登录状态
    local active_account
    active_account=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)
    
    if [ -z "$active_account" ]; then
        log "ERROR" "请先运行 'gcloud auth login' 登录"
        exit 1
    fi
    
    # 检查gcloud版本（API Keys需要较新版本）
    local gcloud_version
    gcloud_version=$(gcloud version --format='value(Google Cloud SDK)' 2>/dev/null || echo "unknown")
    log "INFO" "gcloud版本: ${gcloud_version}"
    
    # 检查默认项目设置
    local default_project
    default_project=$(gcloud config get-value project 2>/dev/null || echo "")
    if [ -n "$default_project" ]; then
        log "INFO" "当前默认项目: ${default_project}"
    fi
    
    # 检查可用的结算账户
    local billing_count
    billing_count=$(gcloud billing accounts list --filter='open=true' --format='value(name)' 2>/dev/null | wc -l)
    log "INFO" "可用结算账户数量: ${billing_count}"
    
    if [ "$billing_count" -eq 0 ]; then
        log "ERROR" "未找到可用的结算账户，请确保已设置有效的结算账户"
        exit 1
    fi
    
    log "SUCCESS" "环境检查通过 (账号: ${active_account})"
}

# 修复：检查项目名称是否是Gemini项目（以Gemini开头，不区分大小写）
is_gemini_project() {
    local project_name="$1"
    # 转换为小写进行比较，支持 Gemini、gemini、GEMINI 等格式
    local lowercase_name
    lowercase_name=$(echo "$project_name" | tr '[:upper:]' '[:lower:]')
    [[ "$lowercase_name" =~ ^gemini.* ]]
}

# 修复：获取所有项目信息（包含项目ID和名称）
get_all_projects() {
    # 获取项目ID和名称的映射，格式为: "project_id,project_name"
    local projects
    projects=$(gcloud projects list --format='csv[no-heading](projectId,name)' --filter='lifecycleState:ACTIVE' 2>/dev/null || echo "")
    echo "$projects"
}

# 修复：分类项目（根据项目名称而不是ID）
categorize_projects() {
    local all_projects="$1"
    local gemini_projects=()
    local other_projects=()
    
    while IFS=',' read -r project_id project_name; do
        if [ -n "$project_id" ] && [ -n "$project_name" ]; then
            # 去除可能的引号
            project_id=$(echo "$project_id" | sed 's/^"//;s/"$//')
            project_name=$(echo "$project_name" | sed 's/^"//;s/"$//')
            
            # 根据项目名称判断是否为Gemini项目
            if is_gemini_project "$project_name"; then
                gemini_projects+=("$project_id")
            else
                other_projects+=("$project_id")
            fi
        fi
    done <<< "$all_projects"
    
    echo "GEMINI_COUNT:${#gemini_projects[@]}"
    echo "OTHER_COUNT:${#other_projects[@]}"
    for project in "${gemini_projects[@]}"; do
        echo "GEMINI:$project"
    done
    for project in "${other_projects[@]}"; do
        echo "OTHER:$project"
    done
}

# 获取项目的当前名称
get_project_name() {
    local project_id="$1"
    local project_name
    project_name=$(gcloud projects describe "$project_id" --format='value(name)' 2>/dev/null || echo "")
    echo "$project_name"
}

# 重命名项目
rename_project() {
    local project_id="$1"
    local new_name="$2"
    
    # 获取当前项目名称用于日志
    local current_name
    current_name=$(get_project_name "$project_id")
    
    log "INFO" "重命名项目 ${project_id} (${current_name}) -> ${new_name}"
    
    if retry_silent gcloud projects update "$project_id" --name="$new_name" --quiet; then
        log "SUCCESS" "项目重命名成功: ${project_id} -> ${new_name}"
        return 0
    else
        log "ERROR" "项目重命名失败: ${project_id}"
        return 1
    fi
}

# 改进版：检查项目配额并保留测试项目
check_and_create_quota_test_project() {
    log "INFO" "检查项目创建配额..."
    
    # 生成测试项目信息
    local project_prefix
    project_prefix=$(generate_random_gemini_prefix)
    local suffix
    suffix=$(unique_suffix)
    local test_project_id="${project_prefix}-${suffix}"
    local test_project_name="Gemini-API-$(generate_random_4digits)"
    
    log "INFO" "尝试创建测试项目: ${test_project_id}"
    
    # 执行项目创建命令并捕获错误
    local create_output
    create_output=$(gcloud projects create "$test_project_id" --name="$test_project_name" --quiet 2>&1) || {
        # 分析错误信息
        if echo "$create_output" | grep -qi "quota\|limit\|exceeded"; then
            log "WARN" "项目配额已满，无法创建新项目"
            QUOTA_TEST_PROJECT=""
            return 1
        else
            log "WARN" "项目创建失败，可能存在其他问题: ${create_output}"
            QUOTA_TEST_PROJECT=""
            return 1
        fi
    }
    
    # 项目创建成功，保留它作为Gemini项目使用
    log "SUCCESS" "配额检查通过，测试项目创建成功: ${test_project_id}"
    log "INFO" "将保留此项目作为Gemini项目使用，避免配额浪费"
    QUOTA_TEST_PROJECT="$test_project_id"
    
    return 0
}

# 修复：创建新的Gemini项目并写入文件（增加配额检查）
create_gemini_project_to_file() {
    local output_file="$1"
    local project_prefix suffix project_id project_name
    
    project_prefix=$(generate_random_gemini_prefix)
    suffix=$(unique_suffix)  
    project_id="${project_prefix}-${suffix}"
    project_name="Gemini-API-$(generate_random_4digits)"
    
    log "INFO" "尝试创建新Gemini项目: ${project_id} (${project_name})"
    
    # 执行项目创建并捕获详细错误信息
    local create_output create_exit_code
    create_output=$(gcloud projects create "$project_id" --name="$project_name" --quiet 2>&1)
    create_exit_code=$?
    
    if [ $create_exit_code -eq 0 ]; then
        log "SUCCESS" "Gemini项目创建成功: ${project_id}"
        printf "%s" "$project_id" > "$output_file"
        return 0
    else
        # 分析错误原因
        if echo "$create_output" | grep -qi "quota\|limit\|exceeded"; then
            log "WARN" "项目创建失败：配额已满 - ${create_output}"
        elif echo "$create_output" | grep -qi "permission\|denied\|forbidden"; then
            log "ERROR" "项目创建失败：权限不足 - ${create_output}"
        else
            log "ERROR" "项目创建失败：${create_output}"
        fi
        return 1
    fi
}

# 启用项目所需服务
enable_project_services() {
    local proj="$1"

    log "INFO" "为项目 ${proj} 启用必要的API服务..."

    # 增加API Keys服务，这是创建API密钥必需的
    local services=(
        "cloudresourcemanager.googleapis.com"
        "serviceusage.googleapis.com"
        "apikeys.googleapis.com"
        "generativelanguage.googleapis.com"
        "aiplatform.googleapis.com"
        "iam.googleapis.com"
        "iamcredentials.googleapis.com"
    )
    
    local failed=0
    for svc in "${services[@]}"; do
        log "INFO" "启用服务: ${svc}"
        if retry_silent gcloud services enable "$svc" --project="$proj" --quiet; then
            log "SUCCESS" "成功启用服务: ${svc}"
        else
            log "ERROR" "无法启用服务: ${svc}"
            failed=$((failed + 1)) || true
        fi
        # 每个服务之间增加短暂延迟
        sleep 2
    done
    
    if [ $failed -gt 0 ]; then
        log "WARN" "有 ${failed} 个服务启用失败"
        return 1
    fi
    
    return 0
}

# 创建Gemini API密钥
create_gemini_api_key() {
    local project_id="$1"
    
    # 验证项目ID格式（确保是纯净的项目ID）
    if [ -z "$project_id" ] || [[ ! "$project_id" =~ ^[a-z][a-z0-9-]{5,29}$ ]]; then
        log "ERROR" "项目ID格式无效: '${project_id}'"
        return 1
    fi
    
    log "INFO" "为项目 ${project_id} 创建Gemini API密钥..."
    
    # 设置当前项目（避免项目上下文问题）
    if ! gcloud config set project "$project_id" --quiet; then
        log "ERROR" "无法设置当前项目: ${project_id}"
        return 1
    fi
    
    # 验证项目存在且可访问
    if ! gcloud projects describe "$project_id" --quiet >/dev/null 2>&1; then
        log "ERROR" "项目不存在或无访问权限: ${project_id}"
        return 1
    fi
    
    # 检查必要服务是否已启用
    local required_services=("apikeys.googleapis.com" "generativelanguage.googleapis.com")
    for service in "${required_services[@]}"; do
        if ! gcloud services list --enabled --filter="name:${service}" --format="value(name)" --project="$project_id" --quiet | grep -q "$service"; then
            log "WARN" "服务 ${service} 未启用，等待启用..."
            sleep 5
        fi
    done
    
    # 创建API密钥
    log "INFO" "正在创建API密钥..."
    local key_output
    
    # 直接执行命令并捕获JSON输出
    if ! key_output=$(gcloud services api-keys create \
        --project="$project_id" \
        --display-name="Gemini API Key" \
        --api-target=service=generativelanguage.googleapis.com \
        --format=json \
        --quiet 2>/dev/null); then
        
        log "ERROR" "创建API密钥命令失败: ${project_id}"
        return 1
    fi
    
    # 验证输出不为空
    if [ -z "$key_output" ] || [ "$key_output" = "null" ]; then
        log "ERROR" "API密钥创建命令返回空输出: ${project_id}"
        return 1
    fi
    
    # 提取密钥
    local api_key
    api_key=$(parse_json "$key_output" ".keyString")
    
    if [ -z "$api_key" ] || [ "$api_key" = "null" ]; then
        log "ERROR" "无法从响应中提取API密钥: ${project_id}"
        log "ERROR" "响应内容: ${key_output}"
        return 1
    fi
    
    # 验证API密钥格式（Google API密钥通常以AIza开头）
    if [[ ! "$api_key" =~ ^AIza[A-Za-z0-9_-]{35}$ ]]; then
        log "WARN" "API密钥格式可能异常: ${api_key}"
    fi
    
    # 生成Gemini密钥文件名（所有密钥汇总到一个文件）
    local gemini_filename
    gemini_filename=$(generate_gemini_filename) || return 1
    
    local gemini_file="${KEY_DIR}/${gemini_filename}"
    
    # 追加Gemini API密钥到txt文件（每个密钥一行）
    echo "$api_key" >> "$gemini_file"
    chmod 600 "$gemini_file"
    GEMINI_KEYS_GENERATED=$((GEMINI_KEYS_GENERATED + 1))

    log "SUCCESS" "Gemini API密钥已追加到: ${gemini_file}"
    log "INFO" "API密钥: ${api_key}"
    return 0
}

# 配置Vertex服务账号并导出密钥 (采用Python逻辑)
vertex_setup_service_account() {
    local project_id="$1"
    local iteration="$2"  # 新增iteration参数

    # 使用与Python相同的命名规则
    local sa_name="automation-sa-${iteration}"
    local sa_email="${sa_name}@${project_id}.iam.gserviceaccount.com"

    log "INFO" "为项目 ${project_id} 创建Vertex服务账号: ${sa_email}"

    # 确保必要的API已启用 (与Python保持一致)
    local apis_to_enable=("aiplatform.googleapis.com" "iam.googleapis.com")
    for api in "${apis_to_enable[@]}"; do
        log "INFO" "启用API: ${api}"
        if ! gcloud services enable "$api" --project="$project_id" --quiet; then
            log "WARN" "启用API失败: ${api}"
        fi
    done

    # 等待API启用生效
    sleep 2

    # 创建服务账号 (允许已存在的情况)
    if ! gcloud iam service-accounts describe "$sa_email" --project="$project_id" >/dev/null 2>&1; then
        log "INFO" "创建服务账号: ${sa_name}"
        if ! gcloud iam service-accounts create "$sa_name" \
            --display-name="Automation User ${iteration}" \
            --project="$project_id" \
            --quiet; then
            log "ERROR" "创建服务账号失败: ${sa_email}"
            return 1
        fi
    else
        log "INFO" "服务账号已存在: ${sa_name}"
    fi

    # 等待服务账号创建完成
    sleep 2

    # 只分配必要的权限 (与Python保持一致: 最小权限原则)
    log "INFO" "分配aiplatform.user角色..."
    local max_retries=3
    local attempt=1

    while [ $attempt -le $max_retries ]; do
        if gcloud projects add-iam-policy-binding "$project_id" \
            --member="serviceAccount:${sa_email}" \
            --role="roles/aiplatform.user" \
            --quiet; then
            log "SUCCESS" "成功授予aiplatform.user角色"
            break
        else
            log "WARN" "授予角色失败，尝试 ${attempt}/${max_retries}，等待5秒后重试..."
            if [ $attempt -lt $max_retries ]; then
                sleep 5
                attempt=$((attempt + 1))
            else
                log "ERROR" "授予角色最终失败"
                return 1
            fi
        fi
    done

    # 生成密钥文件 (使用Python的命名规则)
    local current_user_email
    current_user_email=$(get_current_user_email)
    local safe_email="${current_user_email//@/_at_}"
    safe_email="${safe_email//\./_dot_}"
    local vertex_filename="${safe_email}-${project_id}-${iteration}.json"
    local key_file="${KEY_DIR}/${vertex_filename}"

    log "INFO" "生成Vertex服务账号密钥: ${vertex_filename}"

    # 重试机制创建密钥
    attempt=1
    while [ $attempt -le $max_retries ]; do
        if gcloud iam service-accounts keys create "$key_file" \
            --iam-account="$sa_email" \
            --project="$project_id" \
            --quiet; then
            chmod 600 "$key_file"
            VERTEX_KEYS_GENERATED=$((VERTEX_KEYS_GENERATED + 1))
            log "SUCCESS" "Vertex密钥已保存: ${key_file}"
            return 0
        else
            log "WARN" "密钥创建失败，尝试 ${attempt}/${max_retries}，等待5秒后重试..."
            if [ $attempt -lt $max_retries ]; then
                sleep 5
                attempt=$((attempt + 1))
            else
                log "ERROR" "密钥创建最终失败: ${sa_email}"
                rm -f "$key_file" 2>/dev/null || true
                return 1
            fi
        fi
    done
}

# 自动获取结算账户
get_billing_account_auto() {
    log "INFO" "自动获取结算账户..."
    
    local billing_accounts
    billing_accounts=$(gcloud billing accounts list --filter='open=true' --format='value(name)' 2>/dev/null || echo "")
    
    if [ -z "$billing_accounts" ]; then
        log "ERROR" "未找到可用的结算账户"
        return 1
    fi
    
    # 自动选择第一个结算账户
    local first_account
    first_account=$(echo "$billing_accounts" | head -n 1)
    BILLING_ACCOUNT="${first_account##*/}"
    
    log "SUCCESS" "自动选择结算账户: ${BILLING_ACCOUNT}"
    return 0
}

# 取消所有项目的账单关联
unlink_all_billing_silent() {
    log "INFO" "====== 第1步: 取消所有现有项目的账单关联 ======"
    
    # 获取所有活跃项目（只需要项目ID）
    local all_project_ids
    all_project_ids=$(gcloud projects list --format='value(projectId)' --filter='lifecycleState:ACTIVE' 2>/dev/null || echo "")
    
    if [ -z "$all_project_ids" ]; then
        log "INFO" "未找到任何活跃项目"
        return 0
    fi
    
    # 筛选有账单关联的项目
    local billing_projects=()
    local total_checked=0
    
    log "INFO" "检查项目账单关联状态..."
    while IFS= read -r project_id; do
        if [ -n "$project_id" ]; then
            total_checked=$((total_checked + 1))
            printf "\r正在检查项目 %d: %s" "$total_checked" "$project_id" >&2
            
            local billing_info
            billing_info=$(gcloud billing projects describe "$project_id" --format='value(billingAccountName)' 2>/dev/null || echo "")
            
            if [ -n "$billing_info" ]; then
                billing_projects+=("$project_id")
            fi
        fi
    done <<< "$all_project_ids"
    
    echo >&2 # 换行
    
    local total=${#billing_projects[@]}
    log "INFO" "找到 ${total} 个关联了账单的项目"
    
    if [ "$total" -eq 0 ]; then
        log "INFO" "没有需要取消账单关联的项目"
        return 0
    fi
    
    log "INFO" "开始取消账单关联..."
    
    local success=0
    local failed=0
    local current=0
    
    for project_id in "${billing_projects[@]}"; do
        current=$((current + 1))
        log "INFO" "[${current}/${total}] 取消项目账单关联: ${project_id}"
        
        if gcloud billing projects unlink "$project_id" --quiet 2>/dev/null; then
            log "SUCCESS" "成功取消账单关联: ${project_id}"
            success=$((success + 1))
        else
            log "ERROR" "取消账单关联失败: ${project_id}"
            failed=$((failed + 1))
        fi
        
        show_progress "$current" "$total"
        sleep 0.5
    done
    
    echo >&2
    log "INFO" "账单关联取消完成 - 成功: ${success}, 失败: ${failed}"
    
    # 等待账单变更生效
    log "INFO" "等待账单变更生效..."
    sleep 5
    
    return 0
}

# 改进：智能项目管理主函数（配额测试项目复用版）
smart_project_management() {
    log "INFO" "====== 第2步: 智能项目管理（配额测试项目复用版） ======"
    
    # 获取所有项目（包含ID和名称）
    local all_projects
    all_projects=$(get_all_projects)
    
    # 分类项目（基于项目名称）
    local project_info
    project_info=$(categorize_projects "$all_projects")
    
    local gemini_count=0
    local other_count=0
    local gemini_projects=()
    local other_projects=()
    
    while IFS= read -r line; do
        if [[ "$line" == GEMINI_COUNT:* ]]; then
            gemini_count=${line#GEMINI_COUNT:}
        elif [[ "$line" == OTHER_COUNT:* ]]; then
            other_count=${line#OTHER_COUNT:}
        elif [[ "$line" == GEMINI:* ]]; then
            gemini_projects+=("${line#GEMINI:}")
        elif [[ "$line" == OTHER:* ]]; then
            other_projects+=("${line#OTHER:}")
        fi
    done <<< "$project_info"
    
    log "INFO" "项目统计: Gemini项目 ${gemini_count} 个, 其他项目 ${other_count} 个"
    
    # 新功能：将现有的Gemini项目重命名为已使用状态
    if [ ${#gemini_projects[@]} -gt 0 ]; then
        log "INFO" "====== 将现有Gemini项目标记为已使用 ======"
        log "INFO" "发现 ${#gemini_projects[@]} 个现有Gemini项目，将重命名为 gemini-yiyong-xxxx 格式"
        
        local renamed_count=0
        for project_id in "${gemini_projects[@]}"; do
            local current_name
            current_name=$(get_project_name "$project_id")
            local new_yiyong_name="gemini-yiyong-$(generate_random_4digits)"
            
            log "INFO" "标记已使用项目: ${project_id} (${current_name}) -> ${new_yiyong_name}"
            
            if rename_project "$project_id" "$new_yiyong_name"; then
                renamed_count=$((renamed_count + 1))
                log "SUCCESS" "项目已标记为已使用: ${project_id}"
            else
                log "ERROR" "标记项目失败: ${project_id}"
            fi
            
            # 重命名间隔，避免API限流
            sleep 2
        done
        
        log "INFO" "完成标记 ${renamed_count} 个项目为已使用状态"
        
        # 重新获取和分类项目（因为Gemini项目已被重命名）
        log "INFO" "重新分类项目..."
        all_projects=$(get_all_projects)
        project_info=$(categorize_projects "$all_projects")
        
        # 重新解析项目分类
        gemini_count=0
        other_count=0
        gemini_projects=()
        other_projects=()
        
        while IFS= read -r line; do
            if [[ "$line" == GEMINI_COUNT:* ]]; then
                gemini_count=${line#GEMINI_COUNT:}
            elif [[ "$line" == OTHER_COUNT:* ]]; then
                other_count=${line#OTHER_COUNT:}
            elif [[ "$line" == GEMINI:* ]]; then
                gemini_projects+=("${line#GEMINI:}")
            elif [[ "$line" == OTHER:* ]]; then
                other_projects+=("${line#OTHER:}")
            fi
        done <<< "$project_info"
        
        log "INFO" "重新分类后统计: Gemini项目 ${gemini_count} 个, 其他项目 ${other_count} 个"
    fi
    
    # 显示详细的项目分类信息
    if [ ${#gemini_projects[@]} -gt 0 ]; then
        log "INFO" "当前Gemini项目（新的）:"
        for project_id in "${gemini_projects[@]}"; do
            local project_name
            project_name=$(get_project_name "$project_id")
            log "INFO" "  - ${project_id} (${project_name})"
        done
    fi
    
    if [ ${#other_projects[@]} -gt 0 ]; then
        log "INFO" "其他项目（包括已使用的gemini-yiyong项目）:"
        for project_id in "${other_projects[@]}"; do
            local project_name
            project_name=$(get_project_name "$project_id")
            # 特别标记已使用的项目
            if [[ "$project_name" =~ ^gemini-yiyong-.* ]]; then
                log "INFO" "  - ${project_id} (${project_name}) [已使用]"
            else
                log "INFO" "  - ${project_id} (${project_name})"
            fi
        done
    fi
    
    # 目标Gemini项目列表
    local target_gemini_projects=()
    
    # 新增：智能分析策略（配额测试项目复用版）
    log "INFO" "====== 智能分析最佳策略（配额测试项目复用版） ======"
    
    # 首先检查配额并创建测试项目（如果成功则保留使用）
    local can_create_new=false
    if check_and_create_quota_test_project; then
        can_create_new=true
        if [ -n "$QUOTA_TEST_PROJECT" ]; then
            log "SUCCESS" "配额测试项目已创建并保留: ${QUOTA_TEST_PROJECT}"
            # 将测试项目加入目标列表
            target_gemini_projects+=("$QUOTA_TEST_PROJECT")
        fi
    else
        can_create_new=false
        log "WARN" "项目配额已满，将仅处理现有项目"
    fi
    
    # 计算还需要多少个项目
    local current_count=${#target_gemini_projects[@]}
    local needed=$((3 - current_count))
    
    log "INFO" "当前已有 ${current_count} 个Gemini项目，还需要 ${needed} 个"
    
    # 计算可用于重命名的项目数量
    local available_for_rename=${#other_projects[@]}
    log "INFO" "可用于重命名的其他项目: ${available_for_rename} 个"
    
    # 优先重命名现有项目
    if [ "$needed" -gt 0 ] && [ "$available_for_rename" -gt 0 ]; then
        local rename_count=$needed
        if [ "$rename_count" -gt "$available_for_rename" ]; then
            rename_count=$available_for_rename
        fi
        
        log "INFO" "将重命名 ${rename_count} 个现有项目为Gemini项目"
        
        for i in $(seq 0 $((rename_count - 1))); do
            if [ $i -lt ${#other_projects[@]} ]; then
                local project_id="${other_projects[$i]}"
                local new_name="Gemini-API-$(generate_random_4digits)"
                
                if rename_project "$project_id" "$new_name"; then
                    target_gemini_projects+=("$project_id")
                    log "SUCCESS" "重命名成功: ${project_id} -> ${new_name}"
                else
                    log "ERROR" "重命名项目失败: $project_id"
                fi
                
                sleep 2
            fi
        done
        
        # 更新需要的数量
        current_count=${#target_gemini_projects[@]}
        needed=$((3 - current_count))
    fi
    
    # 如果还需要更多项目且可以创建新项目
    if [ "$needed" -gt 0 ] && [ "$can_create_new" = true ]; then
        log "INFO" "尝试创建 ${needed} 个新项目以达到目标数量"
        
        for attempt in $(seq 1 $needed); do
            local temp_project_file="${TEMP_DIR}/new_project_${attempt}.txt"
            
            if create_gemini_project_to_file "$temp_project_file"; then
                local new_project
                new_project=$(cat "$temp_project_file" 2>/dev/null | tr -d '\n\r\t' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
                
                if [ -n "$new_project" ] && [[ "$new_project" =~ ^[a-z][a-z0-9-]{5,29}$ ]]; then
                    target_gemini_projects+=("$new_project")
                    log "SUCCESS" "创建新项目: $new_project"
                fi
            else
                log "WARN" "创建新项目失败（第${attempt}次尝试）"
                # 如果创建失败，可能是配额用完了
                break
            fi
            
            rm -f "$temp_project_file" 2>/dev/null || true
            sleep 3
        done
    fi
    
    # 最终结果评估
    local final_count=${#target_gemini_projects[@]}
    
    log "INFO" "====== 项目管理结果评估 ======"
    
    if [ "$final_count" -eq 0 ]; then
        log "ERROR" "未能准备任何Gemini项目，流程无法继续"
        return 1
    elif [ "$final_count" -eq 1 ]; then
        log "WARN" "只准备了1个Gemini项目，少于理想数量(3个)，但仍可继续"
        log "INFO" "建议：尝试释放一些项目配额或删除不需要的项目"
    elif [ "$final_count" -eq 2 ]; then
        log "SUCCESS" "准备了2个Gemini项目，这是很好的结果！"
        log "INFO" "虽然少于理想数量(3个)，但已经很实用了"
    elif [ "$final_count" -eq 3 ]; then
        log "SUCCESS" "完美！成功准备了3个Gemini项目"
    else
        log "SUCCESS" "超额完成！准备了 ${final_count} 个Gemini项目"
    fi
    
    log "INFO" "将配置以下 ${final_count} 个Gemini项目:"
    for i in "${!target_gemini_projects[@]}"; do
        local project_id="${target_gemini_projects[$i]}"
        local project_name
        project_name=$(get_project_name "$project_id")
        if [ "$project_id" = "$QUOTA_TEST_PROJECT" ]; then
            log "INFO" "  ${i}. ${project_id} (${project_name}) [配额测试项目复用]"
        else
            log "INFO" "  ${i}. ${project_id} (${project_name})"
        fi
    done
    
    # 将目标项目保存到全局变量
    FINAL_GEMINI_PROJECTS=("${target_gemini_projects[@]}")
    
    return 0
}

# 改进：配置项目（根据模式生成密钥）
configure_projects() {
    log "INFO" "====== 第3步: 配置项目并生成密钥 ======"

    if [ ${#FINAL_GEMINI_PROJECTS[@]} -eq 0 ]; then
        log "ERROR" "没有可配置的项目"
        return 1
    fi

    get_billing_account_auto || return 1

    local gemini_file=""
    if should_process_gemini; then
        local gemini_filename
        gemini_filename=$(generate_gemini_filename) || return 1
        gemini_file="${KEY_DIR}/${gemini_filename}"
        > "$gemini_file"
        chmod 600 "$gemini_file"
        log "INFO" "初始化Gemini API密钥汇总文件: ${gemini_file}"
    fi

    local total=${#FINAL_GEMINI_PROJECTS[@]}
    local success=0
    local failed=0
    local current=0

    log "INFO" "将为 ${total} 个项目执行配置 (模式: ${PROCESS_MODE})"

    for project_id in "${FINAL_GEMINI_PROJECTS[@]}"; do
        current=$((current + 1))
        log "INFO" "[${current}/${total}] 配置项目: ${project_id}"

        project_id=$(echo "$project_id" | tr -d '\n\r\t' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

        if [ -z "$project_id" ] || [[ ! "$project_id" =~ ^[a-z][a-z0-9-]{5,29}$ ]]; then
            log "ERROR" "项目ID格式异常，跳过: '${project_id}'"
            failed=$((failed + 1))
            show_progress "$current" "$total"
            continue
        fi

        log "INFO" "关联结算账户..."
        if ! retry_silent gcloud billing projects link "$project_id" --billing-account="$BILLING_ACCOUNT" --quiet; then
            log "ERROR" "关联结算账户失败: ${project_id}"
            failed=$((failed + 1))
            show_progress "$current" "$total"
            continue
        fi

        log "INFO" "等待账单关联生效..."
        sleep 10

        log "INFO" "启用项目服务..."
        if ! enable_project_services "$project_id"; then
            log "ERROR" "启用项目服务失败: ${project_id}"
            failed=$((failed + 1))
            show_progress "$current" "$total"
            continue
        fi

        log "INFO" "等待服务完全生效..."
        sleep 30

        log "INFO" "验证服务状态..."
        local services_ready=true
        local required_services=("apikeys.googleapis.com" "generativelanguage.googleapis.com")
        if should_process_vertex; then
            required_services+=("aiplatform.googleapis.com" "iam.googleapis.com" "iamcredentials.googleapis.com")
        fi

        for service in "${required_services[@]}"; do
            if ! gcloud services list --enabled --filter="name:${service}" --format="value(name)" --project="$project_id" --quiet | grep -q "$service"; then
                log "WARN" "服务 ${service} 尚未完全启用"
                services_ready=false
            fi
        done

        if [ "$services_ready" = false ]; then
            log "WARN" "等待服务启用完成..."
            sleep 20
        fi

        local project_success=true

        if should_process_vertex; then
            log "INFO" "配置Vertex服务账号..."
            if ! vertex_setup_service_account "$project_id" "$current"; then
                log "ERROR" "Vertex配置失败: ${project_id}"
                project_success=false
            fi
        fi

        if should_process_gemini; then
            log "INFO" "创建Gemini API密钥..."
            if ! create_gemini_api_key "$project_id"; then
                log "ERROR" "Gemini密钥创建失败: ${project_id}"
                project_success=false
            fi
        fi

        if [ "$project_success" = true ]; then
            success=$((success + 1))
        else
            failed=$((failed + 1))
        fi

        show_progress "$current" "$total"

        if [ $current -lt $total ]; then
            log "INFO" "等待后续项目处理..."
            sleep 5
        fi
    done

    echo >&2
    log "INFO" "项目配置完成 - 成功: ${success}, 失败: ${failed}"

    if [ "$success" -eq 0 ]; then
        log "ERROR" "所有项目配置均失败"
        return 1
    elif [ "$failed" -gt 0 ]; then
        log "WARN" "部分项目配置失败，将继续处理成功的项目"
    fi

    return 0
}

# 上传密钥文件到FTP（支持类型筛选）
upload_keys_to_ftp() {
    local key_type="${1:-all}"
    local keys_dir="${2:-$KEY_DIR}"

    case "$key_type" in
        gemini|vertex|all)
            ;;
        *)
            log "ERROR" "不支持的密钥类型: ${key_type}"
            return 1
            ;;
    esac

    check_ftp_client || return 1

    log "INFO" "开始上传密钥文件到FTP服务器 (${key_type})..."
    if [ -n "$FTP_REMOTE_DIR" ]; then
        log "INFO" "FTP服务器: ${FTP_SERVER}:${FTP_PORT}/${FTP_REMOTE_DIR}"
    else
        log "INFO" "FTP服务器: ${FTP_SERVER}:${FTP_PORT} (根目录)"
    fi

    if [ ! -d "$keys_dir" ]; then
        log "ERROR" "密钥目录不存在: $keys_dir"
        return 1
    fi

    local find_cmd=(find "$keys_dir" -type f)
    case "$key_type" in
        gemini)
            find_cmd+=(-name '*.txt')
            ;;
        vertex)
            find_cmd+=(-name '*.json')
            ;;
        all)
            find_cmd+=( '(' -name '*.txt' -o -name '*.json' ')' )
            ;;
    esac
    find_cmd+=(-print0)

    local matched_files=()
    while IFS= read -r -d '' file; do
        matched_files+=("$file")
    done < <("${find_cmd[@]}")

    if [ ${#matched_files[@]} -eq 0 ]; then
        log "WARN" "未找到需要上传的密钥文件 (${key_type})"
        return 0
    fi

    local json_count=0
    local txt_count=0
    local gemini_keys_count=0
    local description=""

    case "$key_type" in
        gemini)
            description="Gemini 汇总文件"
            ;;
        vertex)
            description="Vertex JSON 文件"
            ;;
        all)
            description="Gemini + Vertex 文件"
            ;;
    esac

    for file in "${matched_files[@]}"; do
        if [[ "$file" == *.json ]]; then
            json_count=$((json_count + 1))
        elif [[ "$file" == *.txt ]]; then
            txt_count=$((txt_count + 1))
            local line_count
            line_count=$(wc -l < "$file" 2>/dev/null || echo "0")
            gemini_keys_count=$((gemini_keys_count + line_count))
        fi
    done

    LAST_UPLOAD_TXT_COUNT=$txt_count
    LAST_UPLOAD_JSON_COUNT=$json_count
    LAST_UPLOAD_GEMINI_KEYS=$gemini_keys_count

    log "INFO" "找到 ${#matched_files[@]} 个密钥文件 (${description})"
    if [ "$txt_count" -gt 0 ]; then
        log "INFO" "其中包含 ${txt_count} 个Gemini汇总文件，共 ${gemini_keys_count} 个API密钥"
    fi
    if [ "$json_count" -gt 0 ]; then
        log "INFO" "其中包含 ${json_count} 个Vertex密钥文件"
    fi

    local uploaded=0
    local failed=0
    local current=0
    local total=${#matched_files[@]}

    for file in "${matched_files[@]}"; do
        current=$((current + 1))
        local filename=$(basename "$file")
        log "INFO" "[${current}/${total}] 上传密钥文件: $filename"

        if upload_to_ftp "$file" "$filename"; then
            uploaded=$((uploaded + 1))
        else
            failed=$((failed + 1))
        fi

        show_progress "$current" "$total"
        sleep 1
    done

    echo >&2
    log "INFO" "密钥上传完成 - 成功: ${uploaded}, 失败: ${failed}"

    return 0
}

# 归档已上传的密钥文件
archive_key_files() {
    local key_type="${1:-all}"
    local keys_dir="${2:-$KEY_DIR}"

    if [ ! -d "$keys_dir" ]; then
        log "WARN" "密钥目录不存在，跳过归档: $keys_dir"
        return 0
    fi

    local timestamp
    timestamp=$(date '+%Y%m%d-%H%M%S')
    local archive_dir="${ARCHIVE_ROOT}/${key_type}/${timestamp}"
    mkdir -p "$archive_dir" || {
        log "ERROR" "无法创建归档目录: ${archive_dir}"
        return 1
    }
    LAST_ARCHIVE_DIR="$archive_dir"

    local find_cmd=(find "$keys_dir" -type f)
    case "$key_type" in
        gemini)
            find_cmd+=(-name '*.txt')
            ;;
        vertex)
            find_cmd+=(-name '*.json')
            ;;
        all)
            find_cmd+=( '(' -name '*.txt' -o -name '*.json' ')' )
            ;;
        *)
            log "ERROR" "不支持的归档类型: ${key_type}"
            return 1
            ;;
    esac
    find_cmd+=(-print0)

    local files_to_move=()
    while IFS= read -r -d '' file; do
        files_to_move+=("$file")
    done < <("${find_cmd[@]}")

    if [ ${#files_to_move[@]} -eq 0 ]; then
        log "WARN" "没有可归档的文件 (${key_type})"
        return 0
    fi

    for file in "${files_to_move[@]}"; do
        local filename
        filename=$(basename "$file")
        mv "$file" "${archive_dir}/${filename}" 2>/dev/null || {
            log "WARN" "移动文件失败: ${file}"
        }
    done

    log "INFO" "已将 ${#files_to_move[@]} 个${key_type}密钥文件归档到: ${archive_dir}"
    return 0
}

# 改进：运行完全自动化流程（配额测试项目复用版）
run_gemini_automation() {
    log "INFO" "====== 启动密钥管理流程（模式: ${PROCESS_MODE}） ======"

    local user_email
    user_email=$(get_current_user_email) || return 1
    log "INFO" "当前用户: ${user_email}"

    # 第1步: 取消所有现有项目的账单关联
    if ! unlink_all_billing_silent; then
        log "ERROR" "取消账单关联失败"
        return 1
    fi

    # 第2步: 智能项目管理（配额测试项目复用版）
    if ! smart_project_management; then
        log "ERROR" "智能项目管理完全失败"
        return 1
    fi

    if [ ${#FINAL_GEMINI_PROJECTS[@]} -eq 0 ]; then
        log "ERROR" "没有可用的项目"
        return 1
    fi

    local final_count=${#FINAL_GEMINI_PROJECTS[@]}
    log "SUCCESS" "项目准备完成，共 ${final_count} 个"

    if [ "$final_count" -lt 3 ]; then
        log "INFO" "项目数量少于目标值(3)，可能是配额限制，继续执行"
    fi

    # 第3步: 配置项目并生成密钥
    if ! configure_projects; then
        log "WARN" "部分项目配置失败，继续处理已成功的项目"
    fi

    # 第4步: 上传密钥到FTP
    if ! upload_keys_to_ftp "$PROCESS_MODE"; then
        log "WARN" "上传密钥时遇到问题"
    fi

    # 第5步: 归档已上传的密钥
    if ! archive_key_files "$PROCESS_MODE"; then
        log "WARN" "归档密钥文件时遇到问题"
    fi

    # 汇总结果
    log "SUCCESS" "密钥管理流程执行完成（模式: ${PROCESS_MODE}）"

    if should_process_gemini; then
        log "INFO" "Gemini API密钥生成条数: ${GEMINI_KEYS_GENERATED}"
        log "INFO" "Gemini 上传文件: ${LAST_UPLOAD_TXT_COUNT} 个，上传密钥总数: ${LAST_UPLOAD_GEMINI_KEYS}"
    else
        log "INFO" "Gemini 模式未启用，未生成相关密钥"
    fi

    if should_process_vertex; then
        log "INFO" "Vertex 服务账号密钥生成数量: ${VERTEX_KEYS_GENERATED}"
        log "INFO" "Vertex 上传文件: ${LAST_UPLOAD_JSON_COUNT} 个"
    else
        log "INFO" "Vertex 模式未启用，未生成相关密钥"
    fi

    log "INFO" "密钥目录: ${KEY_DIR}"
    log "INFO" "归档目录: ${ARCHIVE_ROOT}"
    if [ -n "$LAST_ARCHIVE_DIR" ]; then
        log "INFO" "最新归档路径: ${LAST_ARCHIVE_DIR}"
    fi

    if [ "$PROCESS_MODE" = "gemini" ]; then
        log "INFO" "已按要求仅处理Gemini密钥"
    elif [ "$PROCESS_MODE" = "vertex" ]; then
        log "INFO" "已按要求仅处理Vertex密钥"
    else
        log "INFO" "Gemini与Vertex密钥均已处理"
    fi

    return 0
}

# ===== 主程序入口 =====

main() {
    # 显示欢迎信息
    echo -e "${PURPLE}${BOLD}" >&2
    echo "╔═══════════════════════════════════════════════════════╗" >&2
    echo "║         GCP Gemini API 智能密钥管理工具 v${VERSION}         ║" >&2
    echo "║                                                       ║" >&2
    echo "║          🧠 智能项目管理 + 配额测试项目复用 🧠           ║" >&2
    echo "║              🎯 避免配额浪费，提高效率 🎯               ║" >&2
    echo "║          🔧 测试项目直接保留使用 🔧                      ║" >&2
    echo "╚═══════════════════════════════════════════════════════╝" >&2
    echo -e "${NC}" >&2

    # 设置处理模式
    if [ $# -gt 0 ]; then
        set_process_mode "$1"
    else
        set_process_mode "all"
    fi

    # 检查环境
    check_env

    # 显示配置信息
    echo -e "\n${YELLOW}智能管理策略 (配额测试项目复用版):${NC}" >&2
    echo "1. 优先取消所有项目账单关联" >&2
    echo "2. 将现有Gemini项目标记为已使用：" >&2
    echo "   - 现有 Gemini-xxx 项目 → gemini-yiyong-xxxx (已使用标记)" >&2
    echo "3. 智能配额检测与项目复用:" >&2
    echo "   - 创建测试项目检查配额 → 成功则保留作为Gemini项目使用 ✨" >&2
    echo "   - 配额允许时 → 继续创建新项目达到3个" >&2
    echo "   - 配额已满时 → 重命名现有项目为Gemini项目" >&2
    echo "4. 避免配额浪费：测试项目永不删除，直接复用" >&2
    echo "5. 为所有成功准备的项目生成API密钥并上传" >&2
    echo >&2
    echo -e "${YELLOW}更新内容 v3.4.0:${NC}" >&2
    echo "- 🚀 新增：配额测试项目复用机制" >&2
    echo "- ✨ 改进：测试项目创建成功后保留使用，避免配额浪费" >&2
    echo "- 🎯 优化：将测试项目作为第一个Gemini项目使用" >&2
    echo "- 💡 增强：更智能的配额管理策略" >&2
    echo "- ✅ 修复：删除测试项目造成的配额浪费问题" >&2
    echo "- 📋 改进：更清晰的项目来源标识" >&2
    echo >&2
    echo -e "${YELLOW}当前配置:${NC}" >&2
    echo "- 目标Gemini项目数: ${TARGET_GEMINI_PROJECTS} (理想)" >&2
    echo "- 偏好Gemini项目数: ${PREFERRED_GEMINI_PROJECTS} (实用)" >&2
    echo "- 最少Gemini项目数: ${MIN_GEMINI_PROJECTS} (底线)" >&2
    echo "- 密钥目录: ${KEY_DIR}" >&2
    echo "- FTP服务器: ${FTP_SERVER}:${FTP_PORT}" >&2
    echo "- 当前模式: ${PROCESS_MODE}" >&2
    if [ -n "$FTP_REMOTE_DIR" ]; then
        echo "- FTP目录: ${FTP_REMOTE_DIR}" >&2
    else
        echo "- FTP目录: / (根目录)" >&2
    fi
    echo "- 密钥文件命名: 邮箱.txt (汇总所有Gemini密钥)" >&2
    echo >&2
    echo -e "${GREEN}配额测试项目复用特性:${NC}" >&2
    echo "- 🔍 创建测试项目检查配额状态" >&2
    echo "- ♻️ 测试项目创建成功后直接保留使用" >&2
    echo "- 🎯 避免删除测试项目造成的30天配额占用" >&2
    echo "- 📊 提高项目配额利用率" >&2
    echo "- ✨ 更环保的资源管理方式" >&2
    echo >&2

    # 执行自动化流程
    if run_gemini_automation; then
        log "SUCCESS" "密钥管理流程执行成功！"
        exit 0
    else
        log "ERROR" "密钥管理流程执行失败！"
        exit 1
    fi
}

# 运行主程序
main "$@"

