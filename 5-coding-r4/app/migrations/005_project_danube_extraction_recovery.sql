SET XACT_ABORT ON;
GO

DECLARE @tenant_id NVARCHAR(64) = N'27140306-eea5-4e7f-91e9-4c9e86864b3a';
DECLARE @case_id NVARCHAR(128) = N'project-danube';
DECLARE @messages TABLE (message_id NVARCHAR(128) NOT NULL);

EXEC sys.sp_set_session_context @key = N'tenant_id', @value = @tenant_id;
EXEC sys.sp_set_session_context @key = N'case_id', @value = @case_id;

INSERT @messages (message_id)
SELECT message_id
FROM dbo.work_items
WHERE tenant_id = @tenant_id
  AND case_id = @case_id
  AND operation = N'REQUEST_EXTRACTION'
  AND evidence_id IN (N'evidence-board-pack', N'evidence-erp-rebates');

DELETE target
FROM dbo.queue_outbox AS target
JOIN @messages AS interrupted ON interrupted.message_id = target.message_id
WHERE target.tenant_id = @tenant_id
  AND target.case_id = @case_id
  AND target.queue_name = N'q-extraction';

DELETE dbo.work_items
WHERE tenant_id = @tenant_id
  AND case_id = @case_id
  AND operation = N'REQUEST_EXTRACTION'
  AND evidence_id IN (N'evidence-board-pack', N'evidence-erp-rebates');

DELETE dbo.idempotency_records
WHERE tenant_id = @tenant_id
  AND case_id = @case_id
  AND operation_id = N'admitEvidence';
GO
