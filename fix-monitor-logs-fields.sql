-- 为 gcloud_monitor_logs 表添加缺失的字段

USE gcloud;

-- 添加 available_channels 字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'gcloud_monitor_logs' AND COLUMN_NAME = 'available_channels') = 0,
  'ALTER TABLE gcloud_monitor_logs ADD COLUMN available_channels INT DEFAULT 0 COMMENT "Number of available channels found"',
  'SELECT "available_channels already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 tested_channels 字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'gcloud_monitor_logs' AND COLUMN_NAME = 'tested_channels') = 0,
  'ALTER TABLE gcloud_monitor_logs ADD COLUMN tested_channels INT DEFAULT 0 COMMENT "Number of channels tested"',
  'SELECT "tested_channels already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 successful_channels 字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'gcloud_monitor_logs' AND COLUMN_NAME = 'successful_channels') = 0,
  'ALTER TABLE gcloud_monitor_logs ADD COLUMN successful_channels INT DEFAULT 0 COMMENT "Number of successful channels"',
  'SELECT "successful_channels already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 failed_channels 字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'gcloud_monitor_logs' AND COLUMN_NAME = 'failed_channels') = 0,
  'ALTER TABLE gcloud_monitor_logs ADD COLUMN failed_channels TEXT NULL COMMENT "JSON array of failed channel IDs"',
  'SELECT "failed_channels already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 disabled_channels 字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'gcloud_monitor_logs' AND COLUMN_NAME = 'disabled_channels') = 0,
  'ALTER TABLE gcloud_monitor_logs ADD COLUMN disabled_channels TEXT NULL COMMENT "JSON array of disabled channel IDs"',
  'SELECT "disabled_channels already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 script_executed 字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'gcloud_monitor_logs' AND COLUMN_NAME = 'script_executed') = 0,
  'ALTER TABLE gcloud_monitor_logs ADD COLUMN script_executed TINYINT(1) DEFAULT 0 COMMENT "Whether the recovery script was executed"',
  'SELECT "script_executed already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 script_type 字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'gcloud_monitor_logs' AND COLUMN_NAME = 'script_type') = 0,
  'ALTER TABLE gcloud_monitor_logs ADD COLUMN script_type ENUM("gemini", "vertex") NULL COMMENT "Type of script executed"',
  'SELECT "script_type already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 start_time 字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'gcloud_monitor_logs' AND COLUMN_NAME = 'start_time') = 0,
  'ALTER TABLE gcloud_monitor_logs ADD COLUMN start_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT "When the monitoring started"',
  'SELECT "start_time already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 end_time 字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'gcloud_monitor_logs' AND COLUMN_NAME = 'end_time') = 0,
  'ALTER TABLE gcloud_monitor_logs ADD COLUMN end_time DATETIME NULL COMMENT "When the monitoring ended"',
  'SELECT "end_time already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 test_details 字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'gcloud_monitor_logs' AND COLUMN_NAME = 'test_details') = 0,
  'ALTER TABLE gcloud_monitor_logs ADD COLUMN test_details TEXT NULL COMMENT "JSON array containing detailed test results"',
  'SELECT "test_details already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 修改 monitor_status 字段类型
ALTER TABLE gcloud_monitor_logs MODIFY COLUMN monitor_status
  ENUM('started', 'checking', 'success', 'failed', 'script_executed', 'skipped', 'completed', 'script_started', 'disabled', 'partial_failure', 'all_failed_cooldown')
  NOT NULL DEFAULT 'started'
  COMMENT 'Status of the monitoring task';

-- 显示最终表结构
DESCRIBE gcloud_monitor_logs;
