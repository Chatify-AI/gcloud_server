-- 修复账户删除失败问题
-- 问题：删除GCloud账户时因外键约束失败
-- 原因：command_executions表的外键没有ON DELETE CASCADE

-- 备份说明：
-- 在生产环境执行前，建议先备份相关表：
-- mysqldump -u gcloud -p gcloud command_executions > command_executions_backup.sql

-- 1. 删除旧的外键约束
ALTER TABLE command_executions
DROP FOREIGN KEY command_executions_ibfk_1;

-- 2. 添加新的外键约束，包含ON DELETE CASCADE
ALTER TABLE command_executions
ADD CONSTRAINT command_executions_ibfk_1
FOREIGN KEY (account_id)
REFERENCES g_cloud_accounts(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 验证修改
-- 执行以下查询验证外键约束已正确设置：
SELECT
  TABLE_NAME,
  CONSTRAINT_NAME,
  DELETE_RULE,
  UPDATE_RULE
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE
  CONSTRAINT_SCHEMA = 'gcloud'
  AND TABLE_NAME = 'command_executions';

-- 预期结果应该显示：
-- DELETE_RULE = CASCADE
-- UPDATE_RULE = CASCADE

-- 修复完成后的行为：
-- 当删除GCloud账户时，该账户的所有command_executions记录会自动被删除
-- execution_history记录的account_id字段会被设置为NULL（已有ON DELETE SET NULL）

-- 注意事项：
-- 1. 这个修改会影响数据完整性约束
-- 2. 删除账户后，无法恢复关联的执行记录
-- 3. 如果需要保留历史记录，建议在删除账户前先导出相关数据
-- 4. gcloud_monitor_logs表没有外键约束，删除账户后会有孤立记录（按设计）
