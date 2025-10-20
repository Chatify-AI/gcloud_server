-- ==========================================
-- GCloud Manager MySQL 初始化脚本
-- ==========================================

CREATE DATABASE IF NOT EXISTS `gcloud`;
USE `gcloud`;

-- 管理员表
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
    INDEX `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- GCloud 账户表
CREATE TABLE IF NOT EXISTS `g_cloud_account` (
    `id` VARCHAR(36) PRIMARY KEY,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `project_id` VARCHAR(255),
    `config_dir` VARCHAR(500),
    `config_name` VARCHAR(255),
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_email` (`email`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 命令执行表
CREATE TABLE IF NOT EXISTS `command_execution` (
    `id` VARCHAR(36) PRIMARY KEY,
    `account_id` VARCHAR(36),
    `command` LONGTEXT NOT NULL,
    `output` LONGTEXT,
    `error` LONGTEXT,
    `status` VARCHAR(50),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_account_id` (`account_id`),
    INDEX `idx_status` (`status`),
    FOREIGN KEY (`account_id`) REFERENCES `g_cloud_account`(`id`) ON DELETE SET NULL
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
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 会话表
CREATE TABLE IF NOT EXISTS `sessions` (
    `sid` VARCHAR(255) PRIMARY KEY,
    `sess` JSON NOT NULL,
    `expire` DATETIME NOT NULL,
    INDEX `idx_expire` (`expire`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;
