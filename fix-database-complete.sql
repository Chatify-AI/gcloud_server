-- ==========================================
-- 完整数据库修复脚本 v3.6.0
-- ==========================================
-- 修复所有已知的数据库问题

USE gcloud;

-- 1. 添加缺失的 project_name 字段
ALTER TABLE g_cloud_accounts
ADD COLUMN IF NOT EXISTS project_name VARCHAR(255) AFTER project_id;

-- 2. 添加其他可能缺失的字段（幂等操作）
ALTER TABLE g_cloud_accounts
ADD COLUMN IF NOT EXISTS access_token TEXT AFTER project_name,
ADD COLUMN IF NOT EXISTS refresh_token TEXT AFTER access_token,
ADD COLUMN IF NOT EXISTS token_expiry DATETIME AFTER refresh_token,
ADD COLUMN IF NOT EXISTS scopes TEXT AFTER token_expiry,
ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 1 AFTER scopes;

-- 3. 修复外键约束 - command_executions
-- 先删除旧的外键
ALTER TABLE command_executions
DROP FOREIGN KEY IF EXISTS command_executions_ibfk_1;

-- 添加新的外键（包含 ON DELETE CASCADE）
ALTER TABLE command_executions
ADD CONSTRAINT command_executions_ibfk_1
FOREIGN KEY (account_id)
REFERENCES g_cloud_accounts(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 4. 检查并修复 gcloud_monitor_logs 外键
ALTER TABLE gcloud_monitor_logs
DROP FOREIGN KEY IF EXISTS gcloud_monitor_logs_ibfk_1;

ALTER TABLE gcloud_monitor_logs
ADD CONSTRAINT gcloud_monitor_logs_ibfk_1
FOREIGN KEY (account_id)
REFERENCES g_cloud_accounts(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 5. 检查并修复 channel_auto_logs 外键（如果有）
-- 注意：这个表可能没有外键，如果没有会报错，可以忽略
-- ALTER TABLE channel_auto_logs
-- DROP FOREIGN KEY IF EXISTS channel_auto_logs_ibfk_1;

-- 6. 验证表结构
SELECT '=== g_cloud_accounts 表结构 ===' AS info;
DESCRIBE g_cloud_accounts;

SELECT '=== 外键约束检查 ===' AS info;
SELECT
    TABLE_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    DELETE_RULE,
    UPDATE_RULE
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'gcloud'
  AND REFERENCED_TABLE_NAME = 'g_cloud_accounts';

SELECT '=== 修复完成 ===' AS info;
