-- ==========================================
-- GCloud Manager - MySQL 初始化脚本
-- ==========================================

-- 确保数据库存在
CREATE DATABASE IF NOT EXISTS `gcloud`;
USE `gcloud`;

-- ==========================================
-- 用户管理表
-- ==========================================

-- 管理员用户表
CREATE TABLE IF NOT EXISTS `admin` (
    `id` VARCHAR(36) PRIMARY KEY,
    `username` VARCHAR(255) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` VARCHAR(50) DEFAULT 'admin',
    `email` VARCHAR(255),
    `is_active` BOOLEAN DEFAULT TRUE,
    `last_login_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_username` (`username`),
    INDEX `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API Key 表
CREATE TABLE IF NOT EXISTS `api_key` (
    `id` VARCHAR(36) PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `key_hash` VARCHAR(255) NOT NULL UNIQUE,
    `permissions` JSON DEFAULT '[]',
    `rate_limit` INT DEFAULT 100,
    `is_active` BOOLEAN DEFAULT TRUE,
    `expires_at` TIMESTAMP NULL,
    `last_used_at` TIMESTAMP NULL,
    `created_by` VARCHAR(36),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_is_active` (`is_active`),
    INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- GCloud 账户管理表
-- ==========================================

CREATE TABLE IF NOT EXISTS `g_cloud_account` (
    `id` VARCHAR(36) PRIMARY KEY,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `project_id` VARCHAR(255),
    `config_dir` VARCHAR(500),
    `config_name` VARCHAR(255),
    `is_active` BOOLEAN DEFAULT TRUE,
    `need_monitor` BOOLEAN DEFAULT FALSE,
    `script_execution_count` INT DEFAULT 0,
    `last_monitor_time` TIMESTAMP NULL,
    `oauth_data` LONGTEXT,
    `oauth_data_encrypted` BOOLEAN DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_email` (`email`),
    INDEX `idx_is_active` (`is_active`),
    INDEX `idx_need_monitor` (`need_monitor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 命令执行表
-- ==========================================

CREATE TABLE IF NOT EXISTS `command_execution` (
    `id` VARCHAR(36) PRIMARY KEY,
    `account_id` VARCHAR(36),
    `command` LONGTEXT NOT NULL,
    `output` LONGTEXT,
    `error` LONGTEXT,
    `status` VARCHAR(50),
    `exit_code` INT,
    `executed_by` VARCHAR(255),
    `started_at` TIMESTAMP NULL,
    `completed_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_account_id` (`account_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_created_at` (`created_at`),
    FOREIGN KEY (`account_id`) REFERENCES `g_cloud_account`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 执行历史表
CREATE TABLE IF NOT EXISTS `execution_history` (
    `id` VARCHAR(36) PRIMARY KEY,
    `execution_id` VARCHAR(36),
    `status` VARCHAR(50),
    `output` LONGTEXT,
    `error` LONGTEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_execution_id` (`execution_id`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 监控和统计表
-- ==========================================

-- GCloud 监控日志表
CREATE TABLE IF NOT EXISTS `gcloud_monitor_log` (
    `id` VARCHAR(36) PRIMARY KEY,
    `account_id` VARCHAR(36),
    `monitor_status` VARCHAR(50),
    `available_channels` INT DEFAULT 0,
    `tested_channels` INT DEFAULT 0,
    `script_executed` BOOLEAN DEFAULT FALSE,
    `last_execution_time` TIMESTAMP NULL,
    `error_message` LONGTEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_account_id` (`account_id`),
    INDEX `idx_created_at` (`created_at`),
    FOREIGN KEY (`account_id`) REFERENCES `g_cloud_account`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 自动渠道创建日志表
CREATE TABLE IF NOT EXISTS `channel_auto_log` (
    `id` VARCHAR(36) PRIMARY KEY,
    `file_name` VARCHAR(255),
    `channel_name` VARCHAR(255),
    `channel_type` VARCHAR(50),
    `status` VARCHAR(50),
    `attempts` INT DEFAULT 0,
    `error_message` LONGTEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_file_name` (`file_name`),
    INDEX `idx_status` (`status`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 渠道统计表
CREATE TABLE IF NOT EXISTS `channel_statistics` (
    `id` VARCHAR(36) PRIMARY KEY,
    `channel_id` VARCHAR(255),
    `channel_name` VARCHAR(255),
    `message_count` INT DEFAULT 0,
    `error_count` INT DEFAULT 0,
    `success_rate` DECIMAL(5,2) DEFAULT 0,
    `last_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX `idx_channel_id` (`channel_id`),
    INDEX `idx_channel_name` (`channel_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API 使用统计表
CREATE TABLE IF NOT EXISTS `api_usage_stats` (
    `id` VARCHAR(36) PRIMARY KEY,
    `api_key_id` VARCHAR(36),
    `endpoint` VARCHAR(255),
    `method` VARCHAR(10),
    `response_time` INT,
    `status_code` INT,
    `user_agent` VARCHAR(500),
    `client_ip` VARCHAR(50),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_api_key_id` (`api_key_id`),
    INDEX `idx_endpoint` (`endpoint`),
    INDEX `idx_created_at` (`created_at`),
    FOREIGN KEY (`api_key_id`) REFERENCES `api_key`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 会话表 (可选,用于 session 存储)
-- ==========================================

CREATE TABLE IF NOT EXISTS `sessions` (
    `sid` VARCHAR(255) PRIMARY KEY,
    `sess` JSON NOT NULL,
    `expire` DATETIME NOT NULL,
    INDEX `idx_expire` (`expire`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 创建初始索引
-- ==========================================

-- 性能优化索引
ALTER TABLE `command_execution` ADD INDEX `idx_created_at_account` (`created_at`, `account_id`);
ALTER TABLE `gcloud_monitor_log` ADD INDEX `idx_account_created` (`account_id`, `created_at`);
ALTER TABLE `channel_auto_log` ADD INDEX `idx_status_created` (`status`, `created_at`);

-- ==========================================
-- 插入初始数据 (可选)
-- ==========================================

-- 创建默认管理员 (初始密码应该被改为哈希值)
-- 用户名: admin, 密码: changeme123 (需要实际哈希值)
-- INSERT INTO `admin` (`id`, `username`, `password_hash`, `role`, `email`, `is_active`)
-- VALUES ('default-admin-id', 'admin', '<bcrypt-hash-of-password>', 'admin', 'admin@gcloud-manager.local', TRUE);

-- ==========================================
-- 数据库初始化完成
-- ==========================================
COMMIT;
