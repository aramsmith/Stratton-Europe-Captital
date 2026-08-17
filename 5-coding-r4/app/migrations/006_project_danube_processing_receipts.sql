SET XACT_ABORT ON;
GO

DECLARE @tenant_id NVARCHAR(64) = N'27140306-eea5-4e7f-91e9-4c9e86864b3a';
DECLARE @case_id NVARCHAR(128) = N'project-danube';

EXEC sys.sp_set_session_context @key = N'tenant_id', @value = @tenant_id;
EXEC sys.sp_set_session_context @key = N'case_id', @value = @case_id;

DECLARE @evidence TABLE (
  evidence_id NVARCHAR(128) NOT NULL,
  evidence_version_id NVARCHAR(128) NOT NULL,
  payload_reference NVARCHAR(1024) NOT NULL,
  chunk_text NVARCHAR(MAX) NOT NULL
);
INSERT @evidence (
  evidence_id, evidence_version_id, payload_reference, chunk_text
)
VALUES
  (
    N'evidence-board-pack', N'evidence-board-pack-v1',
    N'project-danube/fy25-board-pack.txt',
    N'Page 42 reconciles EUR 4.2 million to the EUR 5.1 million ERP control total. Page 43 records 18% top-three rebate exposure against the approved 12% downside threshold.'
  ),
  (
    N'evidence-erp-rebates', N'evidence-erp-rebates-v1',
    N'project-danube/erp-rebate-export.csv',
    N'Rows 812-885 total exactly EUR 5,100,000.00.'
  ),
  (
    N'evidence-qoe-report', N'evidence-qoe-report-v1',
    N'project-danube/qoe-report.txt',
    N'Reported adjusted EBITDA may be overstated by EUR 4.2-5.1 million until the bridge is normalized.'
  ),
  (
    N'evidence-environmental-permit', N'evidence-environmental-permit-v1',
    N'project-danube/environmental-permit.txt',
    N'Permit CZ-EP-2049 requires Form T-17 filing and written regulator acknowledgement before closing.'
  );

INSERT dbo.work_items (
  tenant_id, case_id, work_item_id, queue_name, operation, message_id,
  idempotency_key, attempt, status, payload_reference, correlation_id,
  work_type, queued_at, completed_at, evidence_id, evidence_version_id
)
SELECT
  @tenant_id, @case_id,
  CONCAT(N'demo-extraction-', evidence_id), N'q-extraction',
  N'REQUEST_EXTRACTION', CONCAT(N'demo-extraction-', evidence_id),
  CONCAT(N'demo-extraction-', evidence_id), 1, N'PROCESSED',
  payload_reference, N'deployment-bootstrap', N'REQUEST_EXTRACTION',
  SYSUTCDATETIME(), SYSUTCDATETIME(), evidence_id, evidence_version_id
FROM @evidence AS desired
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.work_items AS existing
  WHERE existing.tenant_id = @tenant_id
    AND existing.case_id = @case_id
    AND existing.work_item_id = CONCAT(N'demo-extraction-', desired.evidence_id)
);

INSERT dbo.work_items (
  tenant_id, case_id, work_item_id, queue_name, operation, message_id,
  idempotency_key, attempt, status, payload_reference, correlation_id,
  work_type, queued_at, completed_at, evidence_id, evidence_version_id
)
SELECT
  @tenant_id, @case_id,
  CONCAT(N'demo-indexing-', evidence_id), N'q-indexing',
  N'REQUEST_INDEXING', CONCAT(N'demo-indexing-', evidence_id),
  CONCAT(N'demo-indexing-', evidence_id), 1, N'PROCESSED',
  payload_reference, N'deployment-bootstrap', N'REQUEST_INDEXING',
  SYSUTCDATETIME(), SYSUTCDATETIME(), evidence_id, evidence_version_id
FROM @evidence AS desired
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.work_items AS existing
  WHERE existing.tenant_id = @tenant_id
    AND existing.case_id = @case_id
    AND existing.work_item_id = CONCAT(N'demo-indexing-', desired.evidence_id)
);

INSERT dbo.extraction_chunks (
  tenant_id, case_id, evidence_id, evidence_version_id, chunk_id, chunk_text,
  classification, quality_status, policy_version, citation_locator, indexed_at
)
SELECT
  @tenant_id, @case_id, evidence_id, evidence_version_id,
  CONCAT(evidence_id, N'-chunk-1'), chunk_text, N'CONFIDENTIAL',
  N'APPROVED', N'release-1', CONCAT(evidence_id, N':1'), SYSUTCDATETIME()
FROM @evidence AS desired
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.extraction_chunks AS existing
  WHERE existing.tenant_id = @tenant_id
    AND existing.case_id = @case_id
    AND existing.evidence_id = desired.evidence_id
    AND existing.evidence_version_id = desired.evidence_version_id
);

DELETE dbo.idempotency_records
WHERE tenant_id = @tenant_id
  AND case_id = @case_id
  AND operation_id = N'createDemoAnalysisBundle';
GO
