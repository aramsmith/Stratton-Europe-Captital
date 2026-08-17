SET XACT_ABORT ON;
GO

DECLARE @tenant_id NVARCHAR(64) = N'27140306-eea5-4e7f-91e9-4c9e86864b3a';
DECLARE @case_id NVARCHAR(128) = N'project-danube';
DECLARE @user_id NVARCHAR(256) = N'89177235-561c-45ff-87cd-f63f0f5b8710';
DECLARE @purpose NVARCHAR(256) = N'DUE_DILIGENCE';
DECLARE @source_id NVARCHAR(128) = N'project-danube-controlled-files';
DECLARE @licence_id NVARCHAR(128) = N'project-danube-licence';

EXEC sys.sp_set_session_context @key = N'tenant_id', @value = @tenant_id;
EXEC sys.sp_set_session_context @key = N'case_id', @value = @case_id;

IF NOT EXISTS (
  SELECT 1 FROM dbo.case_rollout_control
  WHERE tenant_id = @tenant_id AND case_id = @case_id
)
BEGIN
  INSERT dbo.case_rollout_control (tenant_id, case_id, rollout_sequence)
  VALUES (@tenant_id, @case_id, 1);
END;

IF NOT EXISTS (
  SELECT 1 FROM dbo.eligibility_decisions
  WHERE tenant_id = @tenant_id AND case_id = @case_id
    AND eligibility_decision_id = N'project-danube-deal-approved'
)
BEGIN
  INSERT dbo.eligibility_decisions (
    tenant_id, case_id, eligibility_decision_id, decision_type, subject_id,
    decision, policy_version, input_hash, reason_codes, evaluated_by, rationale
  )
  VALUES (
    @tenant_id, @case_id, N'project-danube-deal-approved', N'DEAL', @case_id,
    N'APPROVED', N'release-1', REPLICATE(N'a', 64), N'[]', @user_id,
    N'Approved Project Danube demonstration eligibility.'
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM dbo.eligibility_decisions
  WHERE tenant_id = @tenant_id AND case_id = @case_id
    AND eligibility_decision_id = N'project-danube-jurisdiction-approved'
)
BEGIN
  INSERT dbo.eligibility_decisions (
    tenant_id, case_id, eligibility_decision_id, decision_type, subject_id,
    decision, policy_version, input_hash, reason_codes, evaluated_by, rationale
  )
  VALUES (
    @tenant_id, @case_id, N'project-danube-jurisdiction-approved', N'JURISDICTION',
    N'EU', N'APPROVED', N'release-1', REPLICATE(N'b', 64), N'[]', @user_id,
    N'Approved Project Danube demonstration jurisdiction.'
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM dbo.cases
  WHERE tenant_id = @tenant_id AND case_id = @case_id
)
BEGIN
  INSERT dbo.cases (
    tenant_id, case_id, jurisdiction, purpose, status, created_by,
    deal_eligibility_decision_id, jurisdiction_eligibility_decision_id,
    rollout_sequence
  )
  VALUES (
    @tenant_id, @case_id, N'EU', @purpose, N'EVIDENCE_QUARANTINED', @user_id,
    N'project-danube-deal-approved', N'project-danube-jurisdiction-approved', 1
  );
END;

DECLARE @roles TABLE (role_name NVARCHAR(64) NOT NULL);
INSERT @roles (role_name)
VALUES
  (N'DataSteward'),
  (N'DealContributor'),
  (N'CaseReader'),
  (N'DealReviewer'),
  (N'LegalApprover'),
  (N'ComplianceApprover');

INSERT dbo.case_access_assignments (
  tenant_id, case_id, subject_id, purpose, role_name, granted_by
)
SELECT @tenant_id, @case_id, @user_id, @purpose, role_name, N'deployment-bootstrap'
FROM @roles AS desired
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.case_access_assignments AS existing
  WHERE existing.tenant_id = @tenant_id
    AND existing.case_id = @case_id
    AND existing.subject_id = @user_id
    AND existing.role_name = desired.role_name
);

IF NOT EXISTS (
  SELECT 1 FROM dbo.source_registrations
  WHERE tenant_id = @tenant_id AND case_id = @case_id AND source_id = @source_id
)
BEGIN
  INSERT dbo.source_registrations (
    tenant_id, case_id, source_id, owner_id, domain, authoritative_status,
    authoritative_system, interface_type, permission_evidence_id,
    connector_evidence_id, permission_scope, jurisdiction, source_version,
    status, source_active
  )
  VALUES (
    @tenant_id, @case_id, @source_id, N'stratton-demo', N'DUE_DILIGENCE',
    N'VERIFIED', N'Stratton Project Danube controlled evidence',
    N'CONTROLLED_FILE_INGESTION', N'project-danube-permission',
    N'project-danube-connector', @purpose, N'EU', N'v1', N'ACTIVE', 1
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM dbo.external_licence_decisions
  WHERE tenant_id = @tenant_id AND case_id = @case_id
    AND source_id = @source_id AND licence_decision_id = @licence_id
)
BEGIN
  INSERT dbo.external_licence_decisions (
    tenant_id, case_id, source_id, licence_decision_id, licence_evidence_id,
    ai_retrieval_allowed, ai_analysis_allowed, purpose_id, purpose_approved,
    privacy_approved, licence_compatible, expires_at, lawful_basis,
    approved_by, reviewed_by
  )
  VALUES (
    @tenant_id, @case_id, @source_id, @licence_id,
    N'project-danube-licence-evidence', 1, 1, @purpose, 1, 1, 1,
    '2030-12-31T23:59:59Z', N'LEGITIMATE_INTEREST', @user_id, @user_id
  );
END;

DECLARE @evidence TABLE (
  evidence_id NVARCHAR(128) NOT NULL,
  evidence_version_id NVARCHAR(128) NOT NULL,
  content_hash NVARCHAR(128) NOT NULL,
  payload_reference NVARCHAR(1024) NOT NULL,
  media_type NVARCHAR(128) NOT NULL
);
INSERT @evidence (
  evidence_id, evidence_version_id, content_hash, payload_reference, media_type
)
VALUES
  (
    N'evidence-board-pack', N'evidence-board-pack-v1', REPLICATE(N'1', 64),
    N'project-danube/fy25-board-pack.txt', N'text/plain'
  ),
  (
    N'evidence-erp-rebates', N'evidence-erp-rebates-v1', REPLICATE(N'2', 64),
    N'project-danube/erp-rebate-export.csv', N'text/csv'
  ),
  (
    N'evidence-qoe-report', N'evidence-qoe-report-v1', REPLICATE(N'3', 64),
    N'project-danube/qoe-report.txt', N'text/plain'
  ),
  (
    N'evidence-environmental-permit', N'evidence-environmental-permit-v1',
    REPLICATE(N'4', 64), N'project-danube/environmental-permit.txt', N'text/plain'
  );

INSERT dbo.evidence_envelopes (
  tenant_id, case_id, evidence_id, source_id, source_version, owner_id,
  captured_at, licence_decision_id, purpose_id, classification, quality_status,
  content_hash, payload_reference, has_special_category_data, is_external_data,
  admission_status, permission_scope_allowed, purpose_of_use_allowed,
  privacy_lawful_basis_present, external_data_licence_present,
  external_data_licence_compatible
)
SELECT
  @tenant_id, @case_id, evidence_id, @source_id, N'v1', N'stratton-demo',
  SYSUTCDATETIME(), @licence_id, @purpose, N'CONFIDENTIAL', N'APPROVED',
  content_hash, payload_reference, 0, 1, N'QUARANTINED', 1, 1, 1, 1, 1
FROM @evidence AS desired
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.evidence_envelopes AS existing
  WHERE existing.tenant_id = @tenant_id
    AND existing.case_id = @case_id
    AND existing.evidence_id = desired.evidence_id
);

INSERT dbo.evidence_objects (
  tenant_id, case_id, evidence_version_id, evidence_id, blob_uri_reference,
  content_hash, media_type, size_bytes, malware_scan_status,
  retention_schedule_id, disposition_status
)
SELECT
  @tenant_id, @case_id, evidence_version_id, evidence_id, payload_reference,
  content_hash, media_type, 1, N'CLEAN', N'project-danube-retention', N'ACTIVE'
FROM @evidence AS desired
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.evidence_objects AS existing
  WHERE existing.tenant_id = @tenant_id
    AND existing.case_id = @case_id
    AND existing.evidence_version_id = desired.evidence_version_id
);
GO
