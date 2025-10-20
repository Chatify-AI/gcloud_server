-- ==========================================
-- GCloud Manager MySQL 初始化脚本 v3.6.0
-- ==========================================
-- 包含所有表结构和修复

CREATE DATABASE IF NOT EXISTS `gcloud` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `gcloud`;

-- ==========================================
-- 管理员表
-- ==========================================
CREATE TABLE IF NOT EXISTS `admins` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(255) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `role` VARCHAR(50) DEFAULT 'admin',
    `email` VARCHAR(255),
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    INDEX `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==========================================
-- GCloud 账户表（主表）
-- ==========================================
CREATE TABLE IF NOT EXISTS `g_cloud_accounts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `display_name` VARCHAR(255),
    `project_id` VARCHAR(255),
    `project_name` VARCHAR(255),
    `access_token` TEXT,
    `refresh_token` TEXT,
    `token_expiry` DATETIME,
    `scopes` TEXT,
    `is_active` TINYINT(1) DEFAULT 1,
    `config_dir` VARCHAR(500),
    `config_name` VARCHAR(100),
    `need_monitor` TINYINT(1) DEFAULT 0,
    `script_execution_count` INT DEFAULT 0,
    `last_monitor_time` DATETIME,
    `last_used` DATETIME,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    INDEX `idx_email` (`email`),
    INDEX `idx_is_active` (`is_active`),
    INDEX `idx_need_monitor` (`need_monitor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==========================================
-- 命令执行历史表（包含 CASCADE 删除）
-- ==========================================
CREATE TABLE IF NOT EXISTS `command_executions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `account_id` INT,
    `command` TEXT NOT NULL,
    `output` LONGTEXT,
    `error` LONGTEXT,
    `status` VARCHAR(50),
    `executed_by` VARCHAR(255),
    `execution_time` INT,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    INDEX `idx_account_id` (`account_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_created_at` (`created_at`),
    CONSTRAINT `command_executions_ibfk_1`
        FOREIGN KEY (`account_id`)
        REFERENCES `g_cloud_accounts`(`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==========================================
-- API Keys 表
-- ==========================================
CREATE TABLE IF NOT EXISTS `api_keys` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `key_hash` VARCHAR(255) NOT NULL UNIQUE,
    `key_prefix` VARCHAR(20),
    `permissions` TEXT,
    `rate_limit` INT DEFAULT 100,
    `is_active` TINYINT(1) DEFAULT 1,
    `expires_at` DATETIME,
    `last_used_at` DATETIME,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    INDEX `idx_key_hash` (`key_hash`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==========================================
-- 公开 API 执行历史表
-- ==========================================
CREATE TABLE IF NOT EXISTS `execution_histories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `execution_id` VARCHAR(36) NOT NULL UNIQUE,
    `command` TEXT NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `output` LONGTEXT,
    `error` LONGTEXT,
    `started_at` DATETIME,
    `completed_at` DATETIME,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    INDEX `idx_execution_id` (`execution_id`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==========================================
-- GCloud 监控日志表（包含 CASCADE 删除）
-- ==========================================
CREATE TABLE IF NOT EXISTS `gcloud_monitor_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `account_id` INT NOT NULL,
    `monitor_status` VARCHAR(50),
    `available_channels` INT DEFAULT 0,
    `tested_channels` INT DEFAULT 0,
    `script_executed` TINYINT(1) DEFAULT 0,
    `script_output` TEXT,
    `script_error` TEXT,
    `channel_keys` TEXT,
    `error_message` TEXT,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    INDEX `idx_account_id` (`account_id`),
    INDEX `idx_created_at` (`created_at`),
    CONSTRAINT `gcloud_monitor_logs_ibfk_1`
        FOREIGN KEY (`account_id`)
        REFERENCES `g_cloud_accounts`(`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==========================================
-- 渠道自动创建日志表
-- ==========================================
CREATE TABLE IF NOT EXISTS `channel_auto_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `file_name` VARCHAR(255) NOT NULL,
    `channel_name` VARCHAR(255),
    `channel_type` VARCHAR(50),
    `status` VARCHAR(50) NOT NULL,
    `oneapi_channel_id` INT,
    `attempts` INT DEFAULT 0,
    `error_message` TEXT,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    INDEX `idx_file_name` (`file_name`),
    INDEX `idx_status` (`status`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==========================================
-- 渠道测试记录表
-- ==========================================
CREATE TABLE IF NOT EXISTS `channel_test_records` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `account_id` INT,
    `channel_name` VARCHAR(255),
    `channel_key` VARCHAR(255),
    `test_status` VARCHAR(50),
    `test_result` TEXT,
    `error_message` TEXT,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    INDEX `idx_account_id` (`account_id`),
    INDEX `idx_test_status` (`test_status`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==========================================
-- 账户统计汇总表
-- ==========================================
CREATE TABLE IF NOT EXISTS `account_summaries` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `account_id` INT NOT NULL UNIQUE,
    `total_channels` INT DEFAULT 0,
    `active_channels` INT DEFAULT 0,
    `failed_channels` INT DEFAULT 0,
    `total_executions` INT DEFAULT 0,
    `last_execution_at` DATETIME,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    INDEX `idx_account_id` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==========================================
-- 渠道统计表
-- ==========================================
CREATE TABLE IF NOT EXISTS `channel_statistics` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `account_id` INT,
    `channel_name` VARCHAR(255),
    `test_count` INT DEFAULT 0,
    `success_count` INT DEFAULT 0,
    `fail_count` INT DEFAULT 0,
    `last_test_at` DATETIME,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    INDEX `idx_account_id` (`account_id`),
    INDEX `idx_channel_name` (`channel_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==========================================
-- 会话表
-- ==========================================
CREATE TABLE IF NOT EXISTS `sessions` (
    `sid` VARCHAR(255) PRIMARY KEY,
    `sess` JSON NOT NULL,
    `expire` DATETIME NOT NULL,
    INDEX `idx_expire` (`expire`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==========================================
-- 初始化完成
-- ==========================================
COMMIT;
