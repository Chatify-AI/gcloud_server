-- 为 g_cloud_accounts 表添加缺失的字段

USE gcloud;

-- 添加 project_name 字段（如果不存在）
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'g_cloud_accounts' AND COLUMN_NAME = 'project_name') = 0,
  'ALTER TABLE g_cloud_accounts ADD COLUMN project_name VARCHAR(255) NULL AFTER project_id',
  'SELECT "project_name already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 access_token 字段（如果不存在）
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'g_cloud_accounts' AND COLUMN_NAME = 'access_token') = 0,
  'ALTER TABLE g_cloud_accounts ADD COLUMN access_token TEXT NULL',
  'SELECT "access_token already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 refresh_token 字段（如果不存在）
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'g_cloud_accounts' AND COLUMN_NAME = 'refresh_token') = 0,
  'ALTER TABLE g_cloud_accounts ADD COLUMN refresh_token TEXT NULL',
  'SELECT "refresh_token already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 token_expiry 字段（如果不存在）
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'g_cloud_accounts' AND COLUMN_NAME = 'token_expiry') = 0,
  'ALTER TABLE g_cloud_accounts ADD COLUMN token_expiry DATETIME NULL',
  'SELECT "token_expiry already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 scopes 字段（如果不存在）
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'g_cloud_accounts' AND COLUMN_NAME = 'scopes') = 0,
  'ALTER TABLE g_cloud_accounts ADD COLUMN scopes TEXT NULL COMMENT "JSON array of OAuth2 scopes"',
  'SELECT "scopes already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 is_active 字段（如果不存在）
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'g_cloud_accounts' AND COLUMN_NAME = 'is_active') = 0,
  'ALTER TABLE g_cloud_accounts ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1',
  'SELECT "is_active already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 显示最终的表结构
DESCRIBE g_cloud_accounts;
