SET XACT_ABORT ON;
GO

DECLARE @tenant_id NVARCHAR(64) = N'27140306-eea5-4e7f-91e9-4c9e86864b3a';
DECLARE @case_id NVARCHAR(128) = N'project-danube';

EXEC sys.sp_set_session_context @key = N'tenant_id', @value = @tenant_id;
EXEC sys.sp_set_session_context @key = N'case_id', @value = @case_id;

DELETE dbo.idempotency_records
WHERE tenant_id = @tenant_id
  AND case_id = @case_id
  AND operation_id = N'admitEvidence';
GO
