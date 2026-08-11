SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'rls')
BEGIN
  EXEC(N'CREATE SCHEMA rls AUTHORIZATION dbo;');
END;
GO

EXEC(N'
  CREATE OR ALTER FUNCTION rls.fn_tenant_case(@tenant_id NVARCHAR(64), @case_id NVARCHAR(128))
  RETURNS TABLE
  WITH SCHEMABINDING
  AS
  RETURN
    SELECT 1 AS allow_row
    WHERE @tenant_id IS NOT NULL
      AND @case_id IS NOT NULL
      AND @tenant_id = CAST(SESSION_CONTEXT(N''tenant_id'') AS NVARCHAR(64))
      AND (
        @case_id = CAST(SESSION_CONTEXT(N''case_id'') AS NVARCHAR(128))
        OR (
          CAST(SESSION_CONTEXT(N''case_id'') AS NVARCHAR(128)) IS NULL
          AND CAST(SESSION_CONTEXT(N''allow_tenant_lookup'') AS INT) = 1
        )
      );
');
GO

EXEC(N'
  CREATE OR ALTER FUNCTION rls.fn_queue_outbox_access(@tenant_id NVARCHAR(64), @case_id NVARCHAR(128))
  RETURNS TABLE
  WITH SCHEMABINDING
  AS
  RETURN
    SELECT 1 AS allow_row
    WHERE (
      @tenant_id IS NOT NULL
      AND @case_id IS NOT NULL
      AND @tenant_id = CAST(SESSION_CONTEXT(N''tenant_id'') AS NVARCHAR(64))
      AND (
        @case_id = CAST(SESSION_CONTEXT(N''case_id'') AS NVARCHAR(128))
        OR (
          CAST(SESSION_CONTEXT(N''case_id'') AS NVARCHAR(128)) IS NULL
          AND CAST(SESSION_CONTEXT(N''allow_tenant_lookup'') AS INT) = 1
        )
      )
    )
    OR (
      USER_NAME() = N''queue_outbox_relay_executor''
      AND CAST(SESSION_CONTEXT(N''queue_outbox_relay_proc'') AS INT) = 1
    );
');
GO

IF OBJECT_ID(N'dbo.case_rollout_control', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.case_rollout_control (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    rollout_sequence INT NOT NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_case_rollout_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_case_rollout_control PRIMARY KEY CLUSTERED (tenant_id, case_id),
    CONSTRAINT UQ_case_rollout_sequence UNIQUE (tenant_id, rollout_sequence),
    CONSTRAINT CK_case_rollout_sequence CHECK (rollout_sequence BETWEEN 1 AND 20)
  );
END;
GO

IF OBJECT_ID(N'dbo.eligibility_decisions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.eligibility_decisions (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    eligibility_decision_id NVARCHAR(128) NOT NULL,
    decision_type NVARCHAR(32) NOT NULL,
    subject_id NVARCHAR(128) NOT NULL,
    decision NVARCHAR(32) NOT NULL,
    policy_version NVARCHAR(64) NOT NULL,
    input_hash NVARCHAR(128) NOT NULL,
    reason_codes NVARCHAR(MAX) NULL,
    evaluated_by NVARCHAR(256) NOT NULL,
    rationale NVARCHAR(MAX) NULL,
    evaluated_at DATETIME2(7) NOT NULL CONSTRAINT DF_eligibility_evaluated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_eligibility_decisions PRIMARY KEY CLUSTERED (tenant_id, case_id, eligibility_decision_id),
    CONSTRAINT CK_eligibility_type CHECK (decision_type IN (N'DEAL', N'JURISDICTION', N'SOURCE')),
    CONSTRAINT CK_eligibility_decision CHECK (decision IN (N'APPROVED', N'DENIED'))
  );
  CREATE INDEX IX_eligibility_lookup ON dbo.eligibility_decisions(tenant_id, case_id, decision_type, decision);
END;
GO

IF OBJECT_ID(N'dbo.cases', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cases (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    jurisdiction NVARCHAR(64) NOT NULL,
    purpose NVARCHAR(256) NOT NULL,
    status NVARCHAR(64) NOT NULL,
    created_by NVARCHAR(256) NOT NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_cases_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(7) NOT NULL CONSTRAINT DF_cases_updated DEFAULT SYSUTCDATETIME(),
    deal_eligibility_decision_id NVARCHAR(128) NOT NULL,
    jurisdiction_eligibility_decision_id NVARCHAR(128) NOT NULL,
    analysis_status NVARCHAR(64) NOT NULL CONSTRAINT DF_cases_analysis_status DEFAULT N'NOT_REQUESTED',
    has_special_category_data BIT NOT NULL CONSTRAINT DF_cases_special_category DEFAULT 0,
    rollout_sequence INT NOT NULL,
    CONSTRAINT PK_cases PRIMARY KEY CLUSTERED (tenant_id, case_id),
    CONSTRAINT FK_cases_rollout FOREIGN KEY (tenant_id, case_id)
      REFERENCES dbo.case_rollout_control(tenant_id, case_id),
    CONSTRAINT FK_cases_deal_eligibility FOREIGN KEY (tenant_id, case_id, deal_eligibility_decision_id)
      REFERENCES dbo.eligibility_decisions(tenant_id, case_id, eligibility_decision_id),
    CONSTRAINT FK_cases_jurisdiction_eligibility FOREIGN KEY (tenant_id, case_id, jurisdiction_eligibility_decision_id)
      REFERENCES dbo.eligibility_decisions(tenant_id, case_id, eligibility_decision_id),
    CONSTRAINT CK_cases_state CHECK (status IN (
      N'DRAFT',
      N'EVIDENCE_QUARANTINED',
      N'EVIDENCE_ADMITTED',
      N'ANALYSIS_REQUESTED',
      N'ANALYSIS_DRAFT_READY',
      N'SPECIALIST_REVIEW_PENDING',
      N'DRAFT_RECOMMENDATION_READY'
    )),
    CONSTRAINT CK_cases_rollout_range CHECK (rollout_sequence BETWEEN 1 AND 20)
  );
END;
GO

IF OBJECT_ID(N'dbo.case_access_assignments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.case_access_assignments (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    subject_id NVARCHAR(256) NOT NULL,
    purpose NVARCHAR(256) NOT NULL,
    role_name NVARCHAR(64) NOT NULL,
    granted_by NVARCHAR(256) NULL,
    granted_at DATETIME2(7) NOT NULL CONSTRAINT DF_case_access_granted DEFAULT SYSUTCDATETIME(),
    revoked_at DATETIME2(7) NULL,
    CONSTRAINT PK_case_access PRIMARY KEY CLUSTERED (tenant_id, case_id, subject_id, role_name),
    CONSTRAINT FK_case_access_case FOREIGN KEY (tenant_id, case_id)
      REFERENCES dbo.cases(tenant_id, case_id)
  );
END;
GO

IF OBJECT_ID(N'dbo.source_registrations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.source_registrations (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    source_id NVARCHAR(128) NOT NULL,
    owner_id NVARCHAR(256) NOT NULL,
    domain NVARCHAR(256) NOT NULL,
    authoritative_status NVARCHAR(64) NOT NULL,
    authoritative_system NVARCHAR(512) NOT NULL,
    interface_type NVARCHAR(64) NOT NULL,
    permission_evidence_id NVARCHAR(128) NOT NULL,
    connector_evidence_id NVARCHAR(128) NOT NULL,
    permission_scope NVARCHAR(256) NULL,
    jurisdiction NVARCHAR(64) NOT NULL,
    source_version NVARCHAR(64) NOT NULL,
    status NVARCHAR(32) NOT NULL,
    source_active BIT NOT NULL CONSTRAINT DF_source_active DEFAULT 0,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_sources_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(7) NOT NULL CONSTRAINT DF_sources_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_source_registrations PRIMARY KEY CLUSTERED (tenant_id, case_id, source_id),
    CONSTRAINT FK_source_registrations_case FOREIGN KEY (tenant_id, case_id)
      REFERENCES dbo.cases(tenant_id, case_id),
    CONSTRAINT CK_source_interface CHECK (interface_type IN (N'READ_ONLY_API', N'CONTROLLED_FILE_INGESTION')),
    CONSTRAINT CK_source_status CHECK (status IN (N'DISABLED', N'ACTIVE', N'SUSPENDED'))
  );
END;
GO

IF OBJECT_ID(N'dbo.external_licence_decisions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.external_licence_decisions (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    source_id NVARCHAR(128) NOT NULL,
    licence_decision_id NVARCHAR(128) NOT NULL,
    licence_evidence_id NVARCHAR(128) NOT NULL,
    ai_retrieval_allowed BIT NOT NULL,
    ai_analysis_allowed BIT NOT NULL,
    purpose_id NVARCHAR(256) NOT NULL,
    purpose_approved BIT NOT NULL,
    privacy_approved BIT NOT NULL,
    licence_compatible BIT NOT NULL,
    expires_at DATETIME2(7) NOT NULL,
    lawful_basis NVARCHAR(128) NOT NULL,
    approved_by NVARCHAR(256) NOT NULL,
    reviewed_by NVARCHAR(256) NOT NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_licence_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_external_licence_decisions PRIMARY KEY CLUSTERED (tenant_id, case_id, source_id, licence_decision_id),
    CONSTRAINT FK_external_licence_source FOREIGN KEY (tenant_id, case_id, source_id)
      REFERENCES dbo.source_registrations(tenant_id, case_id, source_id)
  );
END;
GO

IF OBJECT_ID(N'dbo.evidence_envelopes', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.evidence_envelopes (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    evidence_id NVARCHAR(128) NOT NULL,
    source_id NVARCHAR(128) NOT NULL,
    source_version NVARCHAR(64) NOT NULL,
    owner_id NVARCHAR(256) NOT NULL,
    captured_at DATETIME2(7) NOT NULL,
    licence_decision_id NVARCHAR(128) NOT NULL,
    purpose_id NVARCHAR(256) NOT NULL,
    classification NVARCHAR(128) NOT NULL,
    quality_status NVARCHAR(64) NOT NULL,
    content_hash NVARCHAR(128) NOT NULL,
    payload_reference NVARCHAR(1024) NOT NULL,
    has_special_category_data BIT NOT NULL CONSTRAINT DF_evidence_special_category DEFAULT 0,
    is_external_data BIT NOT NULL CONSTRAINT DF_evidence_external DEFAULT 1,
    admission_status NVARCHAR(32) NOT NULL,
    permission_scope_allowed BIT NOT NULL CONSTRAINT DF_ev_scope DEFAULT 0,
    purpose_of_use_allowed BIT NOT NULL CONSTRAINT DF_ev_purpose DEFAULT 0,
    privacy_lawful_basis_present BIT NOT NULL CONSTRAINT DF_ev_privacy DEFAULT 0,
    external_data_licence_present BIT NOT NULL CONSTRAINT DF_ev_licence_present DEFAULT 0,
    external_data_licence_compatible BIT NOT NULL CONSTRAINT DF_ev_licence_compatible DEFAULT 0,
    admitted_at DATETIME2(7) NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_evidence_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(7) NOT NULL CONSTRAINT DF_evidence_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_evidence_envelopes PRIMARY KEY CLUSTERED (tenant_id, case_id, evidence_id),
    CONSTRAINT FK_evidence_case FOREIGN KEY (tenant_id, case_id)
      REFERENCES dbo.cases(tenant_id, case_id),
    CONSTRAINT FK_evidence_source FOREIGN KEY (tenant_id, case_id, source_id)
      REFERENCES dbo.source_registrations(tenant_id, case_id, source_id),
    CONSTRAINT CK_evidence_admission_status CHECK (admission_status IN (N'QUARANTINED', N'ADMITTED'))
  );
  CREATE INDEX IX_evidence_hash ON dbo.evidence_envelopes(tenant_id, case_id, content_hash);
END;
GO

IF OBJECT_ID(N'dbo.evidence_objects', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.evidence_objects (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    evidence_version_id NVARCHAR(128) NOT NULL,
    evidence_id NVARCHAR(128) NOT NULL,
    blob_uri_reference NVARCHAR(1024) NOT NULL,
    content_hash NVARCHAR(128) NOT NULL,
    media_type NVARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL,
    malware_scan_status NVARCHAR(32) NOT NULL,
    retention_schedule_id NVARCHAR(128) NOT NULL,
    legal_hold_id NVARCHAR(128) NULL,
    disposition_status NVARCHAR(32) NOT NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_evidence_objects_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_evidence_objects PRIMARY KEY CLUSTERED (tenant_id, case_id, evidence_version_id),
    CONSTRAINT UQ_evidence_objects_lineage UNIQUE (tenant_id, case_id, evidence_id, evidence_version_id),
    CONSTRAINT FK_evidence_objects_evidence FOREIGN KEY (tenant_id, case_id, evidence_id)
      REFERENCES dbo.evidence_envelopes(tenant_id, case_id, evidence_id),
    CONSTRAINT CK_evidence_malware CHECK (malware_scan_status IN (N'PENDING', N'CLEAN', N'FAILED', N'UNKNOWN')),
    CONSTRAINT CK_evidence_disposition CHECK (disposition_status IN (N'ACTIVE', N'HOLD', N'DISPOSED'))
  );
END;
GO

IF OBJECT_ID(N'dbo.analysis_runs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.analysis_runs (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    analysis_run_id NVARCHAR(128) NOT NULL,
    model_deployment_id NVARCHAR(128) NOT NULL,
    model_provider_evidence_id NVARCHAR(128) NOT NULL,
    regional_deployment_evidence_id NVARCHAR(128) NOT NULL,
    prompt_governance_evidence_id NVARCHAR(128) NOT NULL,
    prompt_template_version NVARCHAR(128) NOT NULL,
    policy_version NVARCHAR(64) NOT NULL,
    input_manifest_hash NVARCHAR(128) NOT NULL,
    output_manifest_hash NVARCHAR(128) NULL,
    status NVARCHAR(64) NOT NULL,
    output_kind NVARCHAR(32) NOT NULL,
    unsupported_claims INT NOT NULL CONSTRAINT DF_analysis_unsupported DEFAULT 0,
    blocked_reason NVARCHAR(256) NULL,
    output_reference NVARCHAR(1024) NULL,
    queued_at DATETIME2(7) NOT NULL CONSTRAINT DF_analysis_queued DEFAULT SYSUTCDATETIME(),
    started_at DATETIME2(7) NULL,
    completed_at DATETIME2(7) NULL,
    updated_at DATETIME2(7) NOT NULL CONSTRAINT DF_analysis_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_analysis_runs PRIMARY KEY CLUSTERED (tenant_id, case_id, analysis_run_id),
    CONSTRAINT FK_analysis_runs_case FOREIGN KEY (tenant_id, case_id)
      REFERENCES dbo.cases(tenant_id, case_id),
    CONSTRAINT CK_analysis_status CHECK (status IN (
      N'QUEUED',
      N'IN_PROGRESS',
      N'DRAFT_ONLY_READY',
      N'BLOCKED_MISSING_EVIDENCE',
      N'FAILED'
    )),
    CONSTRAINT CK_analysis_output_kind CHECK (output_kind = N'DRAFT_ONLY')
  );
END;
GO

IF OBJECT_ID(N'dbo.material_claims', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.material_claims (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    claim_id NVARCHAR(128) NOT NULL,
    analysis_run_id NVARCHAR(128) NOT NULL,
    claim_text_reference NVARCHAR(MAX) NOT NULL,
    severity NVARCHAR(32) NOT NULL,
    review_status NVARCHAR(32) NOT NULL,
    is_material BIT NOT NULL,
    unsupported_reason NVARCHAR(256) NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_claims_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(7) NOT NULL CONSTRAINT DF_claims_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_material_claims PRIMARY KEY CLUSTERED (tenant_id, case_id, claim_id),
    CONSTRAINT FK_claims_analysis_run FOREIGN KEY (tenant_id, case_id, analysis_run_id)
      REFERENCES dbo.analysis_runs(tenant_id, case_id, analysis_run_id),
    CONSTRAINT CK_claims_severity CHECK (severity IN (N'CRITICAL', N'NON_CRITICAL')),
    CONSTRAINT CK_claims_review_status CHECK (review_status IN (N'PENDING', N'CITED', N'UNSUPPORTED'))
  );
  CREATE INDEX IX_claims_by_run ON dbo.material_claims(tenant_id, case_id, analysis_run_id);
END;
GO

IF OBJECT_ID(N'dbo.citations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.citations (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    citation_id NVARCHAR(128) NOT NULL,
    claim_id NVARCHAR(128) NOT NULL,
    evidence_id NVARCHAR(128) NOT NULL,
    evidence_version_id NVARCHAR(128) NOT NULL,
    locator NVARCHAR(256) NOT NULL,
    accessible_at_review BIT NOT NULL CONSTRAINT DF_citation_accessible DEFAULT 1,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_citations_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_citations PRIMARY KEY CLUSTERED (tenant_id, case_id, citation_id),
    CONSTRAINT FK_citations_claim FOREIGN KEY (tenant_id, case_id, claim_id)
      REFERENCES dbo.material_claims(tenant_id, case_id, claim_id),
    CONSTRAINT FK_citations_admitted_evidence FOREIGN KEY (tenant_id, case_id, evidence_id)
      REFERENCES dbo.evidence_envelopes(tenant_id, case_id, evidence_id),
    CONSTRAINT FK_citations_evidence_lineage FOREIGN KEY (tenant_id, case_id, evidence_id, evidence_version_id)
      REFERENCES dbo.evidence_objects(tenant_id, case_id, evidence_id, evidence_version_id)
  );
END;
GO

IF OBJECT_ID(N'dbo.review_approvals', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.review_approvals (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    review_id NVARCHAR(128) NOT NULL,
    subject_id NVARCHAR(256) NOT NULL,
    review_type NVARCHAR(32) NOT NULL,
    decision NVARCHAR(32) NOT NULL,
    rationale NVARCHAR(MAX) NOT NULL,
    reviewer_object_id NVARCHAR(256) NOT NULL,
    reviewer_version NVARCHAR(64) NOT NULL,
    evidence_manifest_hash NVARCHAR(128) NOT NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_reviews_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_review_approvals PRIMARY KEY CLUSTERED (tenant_id, case_id, review_id),
    CONSTRAINT FK_reviews_case FOREIGN KEY (tenant_id, case_id)
      REFERENCES dbo.cases(tenant_id, case_id),
    CONSTRAINT CK_review_type CHECK (review_type IN (N'DEAL', N'LEGAL', N'COMPLIANCE')),
    CONSTRAINT CK_review_decision CHECK (decision IN (N'APPROVED', N'REJECTED'))
  );
END;
GO

IF OBJECT_ID(N'dbo.policy_decisions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.policy_decisions (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    policy_decision_id NVARCHAR(128) NOT NULL,
    decision_point NVARCHAR(64) NOT NULL,
    policy_version NVARCHAR(64) NOT NULL,
    input_hash NVARCHAR(128) NOT NULL,
    result NVARCHAR(16) NOT NULL,
    reason_codes NVARCHAR(MAX) NOT NULL,
    correlation_id NVARCHAR(128) NOT NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_policy_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_policy_decisions PRIMARY KEY CLUSTERED (tenant_id, case_id, policy_decision_id),
    CONSTRAINT FK_policy_case FOREIGN KEY (tenant_id, case_id)
      REFERENCES dbo.cases(tenant_id, case_id),
    CONSTRAINT CK_policy_result CHECK (result IN (N'ALLOW', N'DENY'))
  );
END;
GO

IF OBJECT_ID(N'dbo.work_items', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.work_items (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    work_item_id NVARCHAR(128) NOT NULL,
    queue_name NVARCHAR(64) NOT NULL,
    operation NVARCHAR(64) NOT NULL,
    message_id NVARCHAR(128) NOT NULL,
    idempotency_key NVARCHAR(160) NOT NULL,
    attempt INT NOT NULL,
    status NVARCHAR(32) NOT NULL,
    payload_reference NVARCHAR(1024) NOT NULL,
    correlation_id NVARCHAR(128) NOT NULL,
    work_type NVARCHAR(64) NOT NULL,
    queued_at DATETIME2(7) NOT NULL,
    completed_at DATETIME2(7) NULL,
    evidence_id NVARCHAR(128) NULL,
    evidence_version_id NVARCHAR(128) NULL,
    analysis_run_id NVARCHAR(128) NULL,
    failure_code NVARCHAR(128) NULL,
    failure_detail NVARCHAR(MAX) NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_work_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(7) NOT NULL CONSTRAINT DF_work_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_work_items PRIMARY KEY CLUSTERED (tenant_id, case_id, work_item_id),
    CONSTRAINT FK_work_case FOREIGN KEY (tenant_id, case_id)
      REFERENCES dbo.cases(tenant_id, case_id),
    CONSTRAINT CK_work_status CHECK (status IN (N'QUEUED', N'IN_PROGRESS', N'PROCESSED', N'DEAD_LETTER', N'REJECTED')),
    CONSTRAINT FK_work_item_analysis_run FOREIGN KEY (tenant_id, case_id, analysis_run_id)
      REFERENCES dbo.analysis_runs(tenant_id, case_id, analysis_run_id),
    CONSTRAINT CK_work_queue CHECK (queue_name IN (N'q-ingestion', N'q-extraction', N'q-analysis', N'q-indexing', N'q-audit-export'))
  );
END;
GO

IF OBJECT_ID(N'dbo.idempotency_records', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.idempotency_records (
    scoped_key NVARCHAR(512) NOT NULL,
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    subject_id NVARCHAR(256) NOT NULL,
    operation_id NVARCHAR(64) NOT NULL,
    idempotency_key NVARCHAR(160) NULL,
    fingerprint NVARCHAR(128) NOT NULL,
    status NVARCHAR(32) NOT NULL,
    response_code INT NULL,
    response_body NVARCHAR(MAX) NULL,
    correlation_id NVARCHAR(128) NOT NULL,
    claim_id NVARCHAR(128) NULL,
    lease_expires_at_epoch_ms BIGINT NOT NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_idempotency_created DEFAULT SYSUTCDATETIME(),
    completed_at DATETIME2(7) NULL,
    CONSTRAINT PK_idempotency_records PRIMARY KEY CLUSTERED (scoped_key),
    CONSTRAINT CK_idempotency_status CHECK (status IN (N'IN_PROGRESS', N'COMPLETED', N'FAILED'))
  );
  CREATE INDEX IX_idempotency_scope ON dbo.idempotency_records(tenant_id, case_id, subject_id, operation_id);
END;
GO

IF OBJECT_ID(N'dbo.extraction_chunks', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.extraction_chunks (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    evidence_id NVARCHAR(128) NOT NULL,
    evidence_version_id NVARCHAR(128) NOT NULL,
    chunk_id NVARCHAR(256) NOT NULL,
    chunk_text NVARCHAR(MAX) NOT NULL,
    classification NVARCHAR(128) NOT NULL,
    quality_status NVARCHAR(64) NOT NULL,
    policy_version NVARCHAR(64) NOT NULL,
    citation_locator NVARCHAR(256) NOT NULL,
    indexed_at DATETIME2(7) NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_extraction_chunks_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_extraction_chunks PRIMARY KEY CLUSTERED (tenant_id, case_id, evidence_id, evidence_version_id, chunk_id),
    CONSTRAINT FK_extraction_chunks_evidence_lineage FOREIGN KEY (tenant_id, case_id, evidence_id, evidence_version_id)
      REFERENCES dbo.evidence_objects(tenant_id, case_id, evidence_id, evidence_version_id)
  );
  CREATE INDEX IX_extraction_chunks_ready ON dbo.extraction_chunks(tenant_id, case_id, evidence_id, evidence_version_id, indexed_at);
END;
GO

IF OBJECT_ID(N'dbo.audit_outbox', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.audit_outbox (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    source_event_id NVARCHAR(128) NOT NULL,
    event_sequence INT NOT NULL,
    actor_id NVARCHAR(256) NOT NULL,
    action NVARCHAR(128) NOT NULL,
    subject_id NVARCHAR(256) NOT NULL,
    correlation_id NVARCHAR(128) NOT NULL,
    outcome NVARCHAR(32) NOT NULL,
    payload_reference NVARCHAR(1024) NOT NULL,
    previous_event_hash NVARCHAR(128) NULL,
    event_hash NVARCHAR(128) NOT NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_audit_created DEFAULT SYSUTCDATETIME(),
    exported_at DATETIME2(7) NULL,
    CONSTRAINT PK_audit_outbox PRIMARY KEY CLUSTERED (tenant_id, case_id, event_sequence),
    CONSTRAINT UQ_audit_outbox_source_event UNIQUE (tenant_id, case_id, source_event_id),
    CONSTRAINT FK_audit_case FOREIGN KEY (tenant_id, case_id)
      REFERENCES dbo.cases(tenant_id, case_id)
  );
END;
GO

IF OBJECT_ID(N'dbo.queue_outbox', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.queue_outbox (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    queue_name NVARCHAR(64) NOT NULL,
    message_id NVARCHAR(128) NOT NULL,
    canonical_body NVARCHAR(MAX) NOT NULL,
    status NVARCHAR(32) NOT NULL,
    attempts INT NOT NULL CONSTRAINT DF_queue_outbox_attempts DEFAULT 0,
    next_attempt_at DATETIME2(7) NOT NULL,
    delivered_at DATETIME2(7) NULL,
    last_error_code NVARCHAR(128) NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_queue_outbox_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(7) NOT NULL CONSTRAINT DF_queue_outbox_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_queue_outbox PRIMARY KEY CLUSTERED (tenant_id, case_id, queue_name, message_id),
    CONSTRAINT FK_queue_outbox_case FOREIGN KEY (tenant_id, case_id)
      REFERENCES dbo.cases(tenant_id, case_id),
    CONSTRAINT CK_queue_outbox_status CHECK (status IN (N'PENDING', N'DELIVERED')),
    CONSTRAINT CK_queue_outbox_queue CHECK (queue_name IN (N'q-ingestion', N'q-extraction', N'q-analysis', N'q-indexing', N'q-audit-export'))
  );
  CREATE INDEX IX_queue_outbox_pending ON dbo.queue_outbox(status, next_attempt_at, tenant_id, case_id);
END;
GO

IF OBJECT_ID(N'dbo.validation_manifests', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.validation_manifests (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    validation_manifest_id NVARCHAR(128) NOT NULL,
    schema_version NVARCHAR(64) NOT NULL,
    generated_by NVARCHAR(256) NOT NULL,
    generated_at DATETIME2(7) NOT NULL CONSTRAINT DF_validation_manifest_generated DEFAULT SYSUTCDATETIME(),
    metadata_json NVARCHAR(MAX) NULL,
    CONSTRAINT PK_validation_manifests PRIMARY KEY CLUSTERED (tenant_id, case_id, validation_manifest_id),
    CONSTRAINT FK_validation_case FOREIGN KEY (tenant_id, case_id)
      REFERENCES dbo.cases(tenant_id, case_id)
  );
END;
GO

IF COL_LENGTH('dbo.cases', 'opened_at') IS NULL
BEGIN
  ALTER TABLE dbo.cases ADD opened_at DATETIME2(7) NOT NULL CONSTRAINT DF_cases_opened_at DEFAULT SYSUTCDATETIME();
END;
GO

IF COL_LENGTH('dbo.cases', 'committee_ready_at') IS NULL
BEGIN
  ALTER TABLE dbo.cases ADD committee_ready_at DATETIME2(7) NULL;
END;
GO

IF COL_LENGTH('dbo.source_registrations', 'domain') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.source_registrations)
    THROW 51000, 'BACKFILL_REQUIRED:source_registrations.domain', 1;
  ALTER TABLE dbo.source_registrations ADD domain NVARCHAR(256) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.source_registrations', 'authoritative_status') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.source_registrations)
    THROW 51000, 'BACKFILL_REQUIRED:source_registrations.authoritative_status', 1;
  ALTER TABLE dbo.source_registrations ADD authoritative_status NVARCHAR(64) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.source_registrations', 'connector_evidence_id') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.source_registrations)
    THROW 51000, 'BACKFILL_REQUIRED:source_registrations.connector_evidence_id', 1;
  ALTER TABLE dbo.source_registrations ADD connector_evidence_id NVARCHAR(128) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.external_licence_decisions', 'purpose_id') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.external_licence_decisions)
    THROW 51000, 'BACKFILL_REQUIRED:external_licence_decisions.purpose_id', 1;
  ALTER TABLE dbo.external_licence_decisions ADD purpose_id NVARCHAR(256) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.external_licence_decisions', 'approved_by') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.external_licence_decisions)
    THROW 51000, 'BACKFILL_REQUIRED:external_licence_decisions.approved_by', 1;
  ALTER TABLE dbo.external_licence_decisions ADD approved_by NVARCHAR(256) NOT NULL;
END;
GO

IF EXISTS (SELECT 1 FROM dbo.external_licence_decisions WHERE reviewed_by IS NULL)
  THROW 51000, 'BACKFILL_REQUIRED:external_licence_decisions.reviewed_by', 1;
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.external_licence_decisions')
    AND name = N'reviewed_by'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE dbo.external_licence_decisions ALTER COLUMN reviewed_by NVARCHAR(256) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'evidence_id') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.analysis_runs)
    THROW 51000, 'BACKFILL_REQUIRED:analysis_runs.evidence_id', 1;
  ALTER TABLE dbo.analysis_runs ADD evidence_id NVARCHAR(128) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'evidence_version_id') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.analysis_runs)
    THROW 51000, 'BACKFILL_REQUIRED:analysis_runs.evidence_version_id', 1;
  ALTER TABLE dbo.analysis_runs ADD evidence_version_id NVARCHAR(128) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'prompt_governance_evidence_id') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.analysis_runs)
    THROW 51000, 'BACKFILL_REQUIRED:analysis_runs.prompt_governance_evidence_id', 1;
  ALTER TABLE dbo.analysis_runs ADD prompt_governance_evidence_id NVARCHAR(128) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'output_manifest_hash') IS NULL
BEGIN
  ALTER TABLE dbo.analysis_runs ADD output_manifest_hash NVARCHAR(128) NULL;
END;
GO

IF EXISTS (SELECT 1 FROM dbo.analysis_runs WHERE model_provider_evidence_id IS NULL)
  THROW 51000, 'BACKFILL_REQUIRED:analysis_runs.model_provider_evidence_id', 1;
GO

IF EXISTS (SELECT 1 FROM dbo.analysis_runs WHERE regional_deployment_evidence_id IS NULL)
  THROW 51000, 'BACKFILL_REQUIRED:analysis_runs.regional_deployment_evidence_id', 1;
GO

IF EXISTS (SELECT 1 FROM dbo.analysis_runs WHERE prompt_governance_evidence_id IS NULL)
  THROW 51000, 'BACKFILL_REQUIRED:analysis_runs.prompt_governance_evidence_id', 1;
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'model_provider_evidence_id'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE dbo.analysis_runs ALTER COLUMN model_provider_evidence_id NVARCHAR(128) NOT NULL;
END;
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'regional_deployment_evidence_id'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE dbo.analysis_runs ALTER COLUMN regional_deployment_evidence_id NVARCHAR(128) NOT NULL;
END;
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'prompt_governance_evidence_id'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE dbo.analysis_runs ALTER COLUMN prompt_governance_evidence_id NVARCHAR(128) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.review_approvals', 'subject_version') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.review_approvals)
    THROW 51000, 'BACKFILL_REQUIRED:review_approvals.subject_version', 1;
  ALTER TABLE dbo.review_approvals ADD subject_version NVARCHAR(128) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.review_approvals', 'decided_at') IS NULL
BEGIN
  ALTER TABLE dbo.review_approvals ADD decided_at DATETIME2(7) NOT NULL CONSTRAINT DF_reviews_decided_at DEFAULT SYSUTCDATETIME();
END;
GO

IF EXISTS (SELECT 1 FROM dbo.review_approvals WHERE reviewer_version IS NULL)
  THROW 51000, 'BACKFILL_REQUIRED:review_approvals.reviewer_version', 1;
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.review_approvals')
    AND name = N'reviewer_version'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE dbo.review_approvals ALTER COLUMN reviewer_version NVARCHAR(64) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.policy_decisions', 'decided_at') IS NULL
BEGIN
  ALTER TABLE dbo.policy_decisions ADD decided_at DATETIME2(7) NOT NULL CONSTRAINT DF_policy_decided_at DEFAULT SYSUTCDATETIME();
END;
GO

IF COL_LENGTH('dbo.idempotency_records', 'lease_expires_at_epoch_ms') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.idempotency_records)
    THROW 51000, 'BACKFILL_REQUIRED:idempotency_records.lease_expires_at_epoch_ms', 1;
  ALTER TABLE dbo.idempotency_records ADD lease_expires_at_epoch_ms BIGINT NOT NULL;
END;
GO

IF COL_LENGTH('dbo.idempotency_records', 'claim_id') IS NULL
BEGIN
  ALTER TABLE dbo.idempotency_records ADD claim_id NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('dbo.work_items', 'work_type') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.work_items)
    THROW 51000, 'BACKFILL_REQUIRED:work_items.work_type', 1;
  ALTER TABLE dbo.work_items ADD work_type NVARCHAR(64) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.work_items', 'queued_at') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.work_items)
    THROW 51000, 'BACKFILL_REQUIRED:work_items.queued_at', 1;
  ALTER TABLE dbo.work_items ADD queued_at DATETIME2(7) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.work_items', 'completed_at') IS NULL
BEGIN
  ALTER TABLE dbo.work_items ADD completed_at DATETIME2(7) NULL;
END;
GO

IF COL_LENGTH('dbo.work_items', 'evidence_id') IS NULL
BEGIN
  ALTER TABLE dbo.work_items ADD evidence_id NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('dbo.work_items', 'evidence_version_id') IS NULL
BEGIN
  ALTER TABLE dbo.work_items ADD evidence_version_id NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('dbo.work_items', 'analysis_run_id') IS NULL
BEGIN
  ALTER TABLE dbo.work_items ADD analysis_run_id NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('dbo.validation_manifests', 'benchmark_version') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.validation_manifests)
    THROW 51000, 'BACKFILL_REQUIRED:validation_manifests.benchmark_version', 1;
  ALTER TABLE dbo.validation_manifests ADD benchmark_version NVARCHAR(64) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.validation_manifests', 'input_hashes') IS NULL
BEGIN
  ALTER TABLE dbo.validation_manifests ADD input_hashes NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('dbo.validation_manifests', 'test_suite_version') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.validation_manifests)
    THROW 51000, 'BACKFILL_REQUIRED:validation_manifests.test_suite_version', 1;
  ALTER TABLE dbo.validation_manifests ADD test_suite_version NVARCHAR(64) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.validation_manifests', 'result_hashes') IS NULL
BEGIN
  ALTER TABLE dbo.validation_manifests ADD result_hashes NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('dbo.validation_manifests', 'producer_identity') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.validation_manifests)
    THROW 51000, 'BACKFILL_REQUIRED:validation_manifests.producer_identity', 1;
  ALTER TABLE dbo.validation_manifests ADD producer_identity NVARCHAR(256) NOT NULL;
END;
GO

IF COL_LENGTH('dbo.audit_outbox', 'source_event_id') IS NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.audit_outbox)
    THROW 51000, 'BACKFILL_REQUIRED:audit_outbox.source_event_id', 1;
  ALTER TABLE dbo.audit_outbox ADD source_event_id NVARCHAR(128) NOT NULL;
END;
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.audit_outbox')
    AND name = N'source_event_id'
    AND is_nullable = 1
)
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.audit_outbox WHERE source_event_id IS NULL)
    THROW 51000, 'BACKFILL_REQUIRED:audit_outbox.source_event_id', 1;
  ALTER TABLE dbo.audit_outbox ALTER COLUMN source_event_id NVARCHAR(128) NOT NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'queue_outbox_relay_executor')
BEGIN
  CREATE USER queue_outbox_relay_executor WITHOUT LOGIN;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_list_pending_queue_outbox_scopes
  @max_scopes INT
WITH EXECUTE AS 'queue_outbox_relay_executor'
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @resolved_max_scopes INT = CASE
    WHEN @max_scopes IS NULL OR @max_scopes < 1 THEN 1
    WHEN @max_scopes > 500 THEN 500
    ELSE @max_scopes
  END;

  BEGIN TRY
    EXEC sys.sp_set_session_context @key=N'queue_outbox_relay_proc', @value=1;
    EXEC sys.sp_set_session_context @key=N'tenant_id', @value=NULL;
    EXEC sys.sp_set_session_context @key=N'case_id', @value=NULL;

    SELECT TOP (@resolved_max_scopes)
      tenant_id,
      case_id,
      MIN(next_attempt_at) AS first_next_attempt_at
    FROM dbo.queue_outbox
    WHERE status=N'PENDING' AND next_attempt_at <= SYSUTCDATETIME()
    GROUP BY tenant_id, case_id
    ORDER BY MIN(next_attempt_at) ASC;
  END TRY
  BEGIN CATCH
    EXEC sys.sp_set_session_context @key=N'queue_outbox_relay_proc', @value=NULL;
    EXEC sys.sp_set_session_context @key=N'case_id', @value=NULL;
    EXEC sys.sp_set_session_context @key=N'tenant_id', @value=NULL;
    THROW;
  END CATCH

  EXEC sys.sp_set_session_context @key=N'queue_outbox_relay_proc', @value=NULL;
  EXEC sys.sp_set_session_context @key=N'case_id', @value=NULL;
  EXEC sys.sp_set_session_context @key=N'tenant_id', @value=NULL;
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.key_constraints
  WHERE name = N'UQ_audit_outbox_source_event'
)
BEGIN
  ALTER TABLE dbo.audit_outbox
    ADD CONSTRAINT UQ_audit_outbox_source_event UNIQUE (tenant_id, case_id, source_event_id);
END;
GO

IF OBJECT_ID(N'dbo.evidence_admission_decisions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.evidence_admission_decisions (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    evidence_id NVARCHAR(128) NOT NULL,
    admission_decision_id NVARCHAR(128) NOT NULL,
    decision NVARCHAR(32) NOT NULL,
    reason_codes NVARCHAR(MAX) NOT NULL,
    policy_version NVARCHAR(64) NOT NULL,
    decider_object_id NVARCHAR(256) NOT NULL,
    decided_at DATETIME2(7) NOT NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_admission_decision_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_evidence_admission_decisions PRIMARY KEY CLUSTERED (tenant_id, case_id, admission_decision_id),
    CONSTRAINT FK_admission_decision_evidence FOREIGN KEY (tenant_id, case_id, evidence_id)
      REFERENCES dbo.evidence_envelopes(tenant_id, case_id, evidence_id),
    CONSTRAINT CK_admission_decision CHECK (decision IN (N'ADMITTED', N'QUARANTINED'))
  );
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_admit_evidence
  @tenant_id NVARCHAR(64),
  @case_id NVARCHAR(128),
  @evidence_id NVARCHAR(128)
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE e
  SET admission_status=N'ADMITTED', admitted_at=SYSUTCDATETIME(), updated_at=SYSUTCDATETIME()
  FROM dbo.evidence_envelopes e
  WHERE e.tenant_id=@tenant_id
    AND e.case_id=@case_id
    AND e.evidence_id=@evidence_id
    AND EXISTS (
      SELECT 1
      FROM dbo.evidence_admission_decisions d
      WHERE d.tenant_id=e.tenant_id
        AND d.case_id=e.case_id
        AND d.evidence_id=e.evidence_id
        AND d.decision=N'ADMITTED'
        AND d.decided_at = (
          SELECT MAX(d2.decided_at)
          FROM dbo.evidence_admission_decisions d2
          WHERE d2.tenant_id=d.tenant_id
            AND d2.case_id=d.case_id
            AND d2.evidence_id=d.evidence_id
        )
    )
    AND EXISTS (
      SELECT 1
      FROM dbo.evidence_objects o
      WHERE o.tenant_id=e.tenant_id
        AND o.case_id=e.case_id
        AND o.evidence_id=e.evidence_id
        AND o.content_hash=e.content_hash
        AND o.malware_scan_status=N'CLEAN'
        AND o.disposition_status<>N'DISPOSED'
        AND o.created_at = (
          SELECT MAX(o2.created_at)
          FROM dbo.evidence_objects o2
          WHERE o2.tenant_id=o.tenant_id
            AND o2.case_id=o.case_id
            AND o2.evidence_id=o.evidence_id
        )
    );

  IF @@ROWCOUNT <> 1
    THROW 51000, 'EVIDENCE_ADMISSION_GUARD_FAILED', 1;
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.key_constraints
  WHERE name = N'UQ_evidence_objects_lineage'
)
BEGIN
  ALTER TABLE dbo.evidence_objects
    ADD CONSTRAINT UQ_evidence_objects_lineage UNIQUE (tenant_id, case_id, evidence_id, evidence_version_id);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = N'FK_analysis_runs_evidence_envelope'
)
BEGIN
  ALTER TABLE dbo.analysis_runs WITH CHECK
    ADD CONSTRAINT FK_analysis_runs_evidence_envelope
      FOREIGN KEY (tenant_id, case_id, evidence_id)
      REFERENCES dbo.evidence_envelopes(tenant_id, case_id, evidence_id);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = N'FK_analysis_runs_evidence_object'
)
BEGIN
  ALTER TABLE dbo.analysis_runs WITH CHECK
    ADD CONSTRAINT FK_analysis_runs_evidence_object
      FOREIGN KEY (tenant_id, case_id, evidence_id, evidence_version_id)
      REFERENCES dbo.evidence_objects(tenant_id, case_id, evidence_id, evidence_version_id);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = N'FK_citations_evidence_lineage'
)
BEGIN
  ALTER TABLE dbo.citations WITH CHECK
    ADD CONSTRAINT FK_citations_evidence_lineage
      FOREIGN KEY (tenant_id, case_id, evidence_id, evidence_version_id)
      REFERENCES dbo.evidence_objects(tenant_id, case_id, evidence_id, evidence_version_id);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = N'FK_extraction_chunks_evidence_lineage'
)
BEGIN
  ALTER TABLE dbo.extraction_chunks WITH CHECK
    ADD CONSTRAINT FK_extraction_chunks_evidence_lineage
      FOREIGN KEY (tenant_id, case_id, evidence_id, evidence_version_id)
      REFERENCES dbo.evidence_objects(tenant_id, case_id, evidence_id, evidence_version_id);
END;
GO

IF OBJECT_ID(N'dbo.trg_eligibility_append_only', N'TR') IS NULL
BEGIN
  EXEC(N'
    CREATE TRIGGER dbo.trg_eligibility_append_only
    ON dbo.eligibility_decisions
    INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      THROW 51000, ''eligibility_decisions is append-only'', 1;
    END;
  ');
END;
GO

IF OBJECT_ID(N'dbo.trg_review_approvals_append_only', N'TR') IS NULL
BEGIN
  EXEC(N'
    CREATE TRIGGER dbo.trg_review_approvals_append_only
    ON dbo.review_approvals
    INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      THROW 51000, ''review_approvals is append-only'', 1;
    END;
  ');
END;
GO

IF OBJECT_ID(N'dbo.trg_policy_decisions_append_only', N'TR') IS NULL
BEGIN
  EXEC(N'
    CREATE TRIGGER dbo.trg_policy_decisions_append_only
    ON dbo.policy_decisions
    INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      THROW 51000, ''policy_decisions is append-only'', 1;
    END;
  ');
END;
GO

IF OBJECT_ID(N'dbo.trg_evidence_admission_decisions_append_only', N'TR') IS NULL
BEGIN
  EXEC(N'
    CREATE TRIGGER dbo.trg_evidence_admission_decisions_append_only
    ON dbo.evidence_admission_decisions
    INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      THROW 51000, ''evidence_admission_decisions is append-only'', 1;
    END;
  ');
END;
GO

IF OBJECT_ID(N'dbo.trg_citations_require_admitted_evidence', N'TR') IS NULL
BEGIN
  EXEC(N'
    CREATE TRIGGER dbo.trg_citations_require_admitted_evidence
    ON dbo.citations
    AFTER INSERT, UPDATE
    AS
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.evidence_envelopes e
          ON e.tenant_id = i.tenant_id
         AND e.case_id = i.case_id
         AND e.evidence_id = i.evidence_id
        JOIN dbo.evidence_objects o
          ON o.tenant_id = i.tenant_id
         AND o.case_id = i.case_id
         AND o.evidence_id = i.evidence_id
         AND o.evidence_version_id = i.evidence_version_id
        WHERE e.admission_status <> N''ADMITTED''
           OR o.malware_scan_status <> N''CLEAN''
      )
      BEGIN
        THROW 51000, ''citations require admitted clean evidence'', 1;
      END
    END;
  ');
END;
GO

IF OBJECT_ID(N'dbo.trg_review_subject_integrity', N'TR') IS NULL
BEGIN
  EXEC(N'
    CREATE TRIGGER dbo.trg_review_subject_integrity
    ON dbo.review_approvals
    AFTER INSERT, UPDATE
    AS
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN dbo.analysis_runs r
          ON r.tenant_id = i.tenant_id
         AND r.case_id = i.case_id
         AND r.analysis_run_id = i.subject_id
         AND r.output_manifest_hash = i.subject_version
        WHERE r.analysis_run_id IS NULL
      )
      BEGIN
        THROW 51000, ''review subject/version must reference an existing analysis run'', 1;
      END
    END;
  ');
END;
GO

IF OBJECT_ID(N'dbo.trg_material_claims_immutable_ready', N'TR') IS NULL
BEGIN
  EXEC(N'
    CREATE TRIGGER dbo.trg_material_claims_immutable_ready
    ON dbo.material_claims
    AFTER INSERT, UPDATE, DELETE
    AS
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM (
          SELECT tenant_id, case_id, analysis_run_id FROM inserted
          UNION
          SELECT tenant_id, case_id, analysis_run_id FROM deleted
        ) c
        JOIN dbo.analysis_runs r
          ON r.tenant_id = c.tenant_id
         AND r.case_id = c.case_id
         AND r.analysis_run_id = c.analysis_run_id
        WHERE r.status = N''DRAFT_ONLY_READY''
      )
      BEGIN
        THROW 51000, ''material claims are immutable after draft readiness'', 1;
      END
    END;
  ');
END;
GO

IF OBJECT_ID(N'dbo.trg_citations_immutable_ready', N'TR') IS NULL
BEGIN
  EXEC(N'
    CREATE TRIGGER dbo.trg_citations_immutable_ready
    ON dbo.citations
    AFTER INSERT, UPDATE, DELETE
    AS
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM (
          SELECT tenant_id, case_id, claim_id FROM inserted
          UNION
          SELECT tenant_id, case_id, claim_id FROM deleted
        ) c
        JOIN dbo.material_claims m
          ON m.tenant_id = c.tenant_id
         AND m.case_id = c.case_id
         AND m.claim_id = c.claim_id
        JOIN dbo.analysis_runs r
          ON r.tenant_id = m.tenant_id
         AND r.case_id = m.case_id
         AND r.analysis_run_id = m.analysis_run_id
        WHERE r.status = N''DRAFT_ONLY_READY''
      )
      BEGIN
        THROW 51000, ''citations are immutable after draft readiness'', 1;
      END
    END;
  ');
END;
GO

IF OBJECT_ID(N'dbo.trg_evidence_envelopes_admit_guard', N'TR') IS NULL
BEGIN
  EXEC(N'
    CREATE TRIGGER dbo.trg_evidence_envelopes_admit_guard
    ON dbo.evidence_envelopes
    AFTER UPDATE
    AS
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN deleted d
          ON d.tenant_id=i.tenant_id AND d.case_id=i.case_id AND d.evidence_id=i.evidence_id
        WHERE d.admission_status<>N''ADMITTED'' AND i.admission_status=N''ADMITTED''
          AND NOT EXISTS (
            SELECT 1
            FROM dbo.evidence_admission_decisions ad
            WHERE ad.tenant_id=i.tenant_id
              AND ad.case_id=i.case_id
              AND ad.evidence_id=i.evidence_id
              AND ad.decision=N''ADMITTED''
              AND ad.decided_at = (
                SELECT MAX(ad2.decided_at)
                FROM dbo.evidence_admission_decisions ad2
                WHERE ad2.tenant_id=ad.tenant_id
                  AND ad2.case_id=ad.case_id
                  AND ad2.evidence_id=ad.evidence_id
              )
          )
      )
      BEGIN
        THROW 51000, ''admission requires append-only admitted decision'', 1;
      END
    END;
  ');
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'stratton_rls_policy')
BEGIN
  CREATE SECURITY POLICY dbo.stratton_rls_policy
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.case_rollout_control,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.eligibility_decisions,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.cases,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.case_access_assignments,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.source_registrations,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.external_licence_decisions,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.evidence_envelopes,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.evidence_admission_decisions,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.evidence_objects,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.analysis_runs,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.material_claims,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.citations,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.review_approvals,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.policy_decisions,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.work_items,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.extraction_chunks,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.idempotency_records,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.audit_outbox,
  ADD FILTER PREDICATE rls.fn_queue_outbox_access(tenant_id, case_id) ON dbo.queue_outbox,
  ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.validation_manifests,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.case_rollout_control AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.case_rollout_control AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.eligibility_decisions AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.eligibility_decisions AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.cases AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.cases AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.case_access_assignments AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.case_access_assignments AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.source_registrations AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.source_registrations AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.external_licence_decisions AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.external_licence_decisions AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.evidence_envelopes AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.evidence_envelopes AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.evidence_admission_decisions AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.evidence_admission_decisions AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.evidence_objects AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.evidence_objects AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.analysis_runs AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.analysis_runs AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.material_claims AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.material_claims AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.citations AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.citations AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.review_approvals AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.review_approvals AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.policy_decisions AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.policy_decisions AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.work_items AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.work_items AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.extraction_chunks AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.extraction_chunks AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.idempotency_records AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.idempotency_records AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.audit_outbox AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.audit_outbox AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.queue_outbox AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.queue_outbox AFTER UPDATE,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.validation_manifests AFTER INSERT,
  ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.validation_manifests AFTER UPDATE
  WITH (STATE = ON);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'workload_api_role')
BEGIN
  CREATE ROLE workload_api_role AUTHORIZATION dbo;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'worker_runtime_role')
BEGIN
  CREATE ROLE worker_runtime_role AUTHORIZATION dbo;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'audit_export_role')
BEGIN
  CREATE ROLE audit_export_role AUTHORIZATION dbo;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'queue_outbox_relay_role')
BEGIN
  CREATE ROLE queue_outbox_relay_role AUTHORIZATION dbo;
END;
GO

GRANT SELECT, INSERT, UPDATE ON dbo.cases TO workload_api_role;
GRANT SELECT, INSERT ON dbo.case_rollout_control TO workload_api_role;
GRANT SELECT ON dbo.eligibility_decisions TO workload_api_role;
GRANT SELECT, INSERT, UPDATE ON dbo.case_access_assignments TO workload_api_role;
GRANT SELECT, INSERT, UPDATE ON dbo.source_registrations TO workload_api_role;
GRANT SELECT, INSERT ON dbo.external_licence_decisions TO workload_api_role;
GRANT SELECT, INSERT ON dbo.evidence_envelopes TO workload_api_role;
GRANT SELECT ON dbo.evidence_objects TO workload_api_role;
GRANT SELECT, INSERT ON dbo.evidence_admission_decisions TO workload_api_role;
GRANT SELECT, INSERT ON dbo.analysis_runs TO workload_api_role;
GRANT SELECT ON dbo.material_claims TO workload_api_role;
GRANT SELECT ON dbo.citations TO workload_api_role;
GRANT SELECT, INSERT ON dbo.review_approvals TO workload_api_role;
GRANT SELECT, INSERT ON dbo.policy_decisions TO workload_api_role;
GRANT SELECT, INSERT, UPDATE ON dbo.work_items TO workload_api_role;
GRANT SELECT, INSERT, UPDATE ON dbo.idempotency_records TO workload_api_role;
GRANT SELECT, INSERT ON dbo.audit_outbox TO workload_api_role;
GRANT SELECT, INSERT, UPDATE ON dbo.queue_outbox TO workload_api_role;
GRANT SELECT, INSERT ON dbo.validation_manifests TO workload_api_role;
GRANT EXECUTE ON dbo.usp_admit_evidence TO workload_api_role;

GRANT SELECT, INSERT, UPDATE ON dbo.work_items TO worker_runtime_role;
GRANT SELECT, INSERT, UPDATE ON dbo.analysis_runs TO worker_runtime_role;
GRANT SELECT, INSERT, UPDATE ON dbo.material_claims TO worker_runtime_role;
GRANT SELECT, INSERT, UPDATE ON dbo.citations TO worker_runtime_role;
GRANT SELECT, INSERT, UPDATE ON dbo.idempotency_records TO worker_runtime_role;
GRANT SELECT, INSERT ON dbo.policy_decisions TO worker_runtime_role;
GRANT SELECT, INSERT ON dbo.audit_outbox TO worker_runtime_role;
GRANT SELECT, INSERT, UPDATE ON dbo.queue_outbox TO worker_runtime_role;
GRANT SELECT, UPDATE ON dbo.cases TO worker_runtime_role;
GRANT SELECT ON dbo.source_registrations TO worker_runtime_role;
GRANT SELECT ON dbo.eligibility_decisions TO worker_runtime_role;
GRANT SELECT ON dbo.external_licence_decisions TO worker_runtime_role;
GRANT SELECT ON dbo.evidence_envelopes TO worker_runtime_role;
GRANT SELECT, INSERT ON dbo.evidence_objects TO worker_runtime_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.extraction_chunks TO worker_runtime_role;
GRANT SELECT ON dbo.evidence_admission_decisions TO worker_runtime_role;
GRANT SELECT ON dbo.analysis_runs TO worker_runtime_role;
GRANT SELECT ON dbo.validation_manifests TO worker_runtime_role;
GRANT DELETE ON dbo.citations TO worker_runtime_role;

GRANT SELECT, INSERT, UPDATE ON dbo.work_items TO audit_export_role;
GRANT SELECT, INSERT, UPDATE ON dbo.idempotency_records TO audit_export_role;
GRANT SELECT, INSERT ON dbo.audit_outbox TO audit_export_role;
GRANT SELECT, UPDATE ON dbo.queue_outbox TO audit_export_role;
GRANT SELECT ON dbo.cases TO audit_export_role;
GRANT SELECT ON dbo.analysis_runs TO audit_export_role;
GRANT SELECT ON dbo.validation_manifests TO audit_export_role;

GRANT EXECUTE ON dbo.usp_list_pending_queue_outbox_scopes TO queue_outbox_relay_role;
GO
