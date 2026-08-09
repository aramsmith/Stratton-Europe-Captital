SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.analysis_bundles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.analysis_bundles (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    analysis_bundle_id NVARCHAR(128) NOT NULL,
    evidence_manifest_hash NVARCHAR(128) NOT NULL,
    model_route NVARCHAR(16) NOT NULL,
    model_deployment_id NVARCHAR(128) NOT NULL,
    route_evidence_id NVARCHAR(128) NOT NULL,
    prompt_template_version NVARCHAR(128) NOT NULL,
    request_fingerprint NVARCHAR(128) NOT NULL,
    status NVARCHAR(64) NOT NULL,
    output_kind NVARCHAR(32) NOT NULL,
    unsupported_claims INT NOT NULL CONSTRAINT DF_analysis_bundles_unsupported DEFAULT 0,
    subject_version NVARCHAR(128) NULL,
    queued_at DATETIME2(7) NOT NULL CONSTRAINT DF_analysis_bundles_queued DEFAULT SYSUTCDATETIME(),
    completed_at DATETIME2(7) NULL,
    updated_at DATETIME2(7) NOT NULL CONSTRAINT DF_analysis_bundles_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_analysis_bundles PRIMARY KEY CLUSTERED (tenant_id, case_id, analysis_bundle_id),
    CONSTRAINT UQ_analysis_bundle_request_fingerprint UNIQUE (tenant_id, case_id, request_fingerprint),
    CONSTRAINT FK_analysis_bundles_case FOREIGN KEY (tenant_id, case_id)
      REFERENCES dbo.cases(tenant_id, case_id),
    CONSTRAINT CK_analysis_bundles_route CHECK (model_route IN (N'LUNA', N'TERRA', N'SOL')),
    CONSTRAINT CK_analysis_bundles_status CHECK (status IN (
      N'QUEUED',
      N'IN_PROGRESS',
      N'DRAFT_ONLY_READY',
      N'BLOCKED_MISSING_EVIDENCE',
      N'FAILED'
    )),
    CONSTRAINT CK_analysis_bundles_output_kind CHECK (output_kind = N'DRAFT_ONLY')
  );
END;
GO

IF OBJECT_ID(N'dbo.analysis_bundle_evidence', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.analysis_bundle_evidence (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    analysis_bundle_id NVARCHAR(128) NOT NULL,
    evidence_id NVARCHAR(128) NOT NULL,
    evidence_version_id NVARCHAR(128) NOT NULL,
    ordinal INT NOT NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_analysis_bundle_evidence_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_analysis_bundle_evidence PRIMARY KEY CLUSTERED (
      tenant_id, case_id, analysis_bundle_id, evidence_id, evidence_version_id
    ),
    CONSTRAINT UQ_analysis_bundle_evidence_ordinal UNIQUE (tenant_id, case_id, analysis_bundle_id, ordinal),
    CONSTRAINT FK_analysis_bundle_evidence_bundle FOREIGN KEY (tenant_id, case_id, analysis_bundle_id)
      REFERENCES dbo.analysis_bundles(tenant_id, case_id, analysis_bundle_id),
    CONSTRAINT FK_analysis_bundle_evidence_lineage FOREIGN KEY (tenant_id, case_id, evidence_id, evidence_version_id)
      REFERENCES dbo.evidence_objects(tenant_id, case_id, evidence_id, evidence_version_id),
    CONSTRAINT CK_analysis_bundle_evidence_ordinal CHECK (ordinal >= 1)
  );
END;
GO

IF OBJECT_ID(N'dbo.analysis_bundle_reviews', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.analysis_bundle_reviews (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    analysis_bundle_id NVARCHAR(128) NOT NULL,
    review_id NVARCHAR(128) NOT NULL,
    subject_version NVARCHAR(128) NOT NULL,
    review_type NVARCHAR(32) NOT NULL,
    decision NVARCHAR(32) NOT NULL,
    rationale NVARCHAR(2048) NOT NULL,
    reviewer_object_id NVARCHAR(256) NOT NULL,
    evidence_manifest_hash NVARCHAR(128) NOT NULL,
    decided_at DATETIME2(7) NOT NULL CONSTRAINT DF_analysis_bundle_reviews_decided DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_analysis_bundle_reviews PRIMARY KEY CLUSTERED (tenant_id, case_id, analysis_bundle_id, review_id),
    CONSTRAINT FK_analysis_bundle_reviews_bundle FOREIGN KEY (tenant_id, case_id, analysis_bundle_id)
      REFERENCES dbo.analysis_bundles(tenant_id, case_id, analysis_bundle_id),
    CONSTRAINT CK_analysis_bundle_reviews_type CHECK (review_type IN (N'DEAL', N'LEGAL', N'COMPLIANCE')),
    CONSTRAINT CK_analysis_bundle_reviews_decision CHECK (decision IN (N'APPROVED', N'REJECTED'))
  );
END;
GO

IF OBJECT_ID(N'dbo.approved_model_route_evidence', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.approved_model_route_evidence (
    tenant_id NVARCHAR(64) NOT NULL,
    case_id NVARCHAR(128) NOT NULL,
    evidence_id NVARCHAR(128) NOT NULL,
    status NVARCHAR(32) NOT NULL,
    resource_id NVARCHAR(512) NOT NULL,
    deployment_id NVARCHAR(128) NOT NULL,
    region NVARCHAR(64) NOT NULL,
    route NVARCHAR(16) NOT NULL,
    api_version NVARCHAR(64) NOT NULL,
    evidence_version NVARCHAR(128) NOT NULL,
    valid_from DATETIME2(7) NOT NULL,
    valid_until DATETIME2(7) NOT NULL,
    created_at DATETIME2(7) NOT NULL CONSTRAINT DF_model_route_evidence_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_approved_model_route_evidence PRIMARY KEY CLUSTERED (tenant_id, case_id, evidence_id),
    CONSTRAINT UQ_approved_model_route_evidence_id UNIQUE (evidence_id),
    CONSTRAINT CK_approved_model_route_status CHECK (status IN (N'APPROVED', N'SUSPENDED', N'EXPIRED')),
    CONSTRAINT CK_approved_model_route_route CHECK (route IN (N'LUNA', N'TERRA', N'SOL')),
    CONSTRAINT CK_approved_model_route_window CHECK (valid_until > valid_from)
  );
END;
GO

IF OBJECT_ID(N'dbo.trg_analysis_bundle_evidence_append_only', N'TR') IS NULL
BEGIN
  EXEC(N'
    CREATE TRIGGER dbo.trg_analysis_bundle_evidence_append_only
    ON dbo.analysis_bundle_evidence
    AFTER UPDATE, DELETE
    AS
    BEGIN
      THROW 52100, ''analysis bundle evidence manifests are append-only'', 1;
    END;
  ');
END;
GO

IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'stratton_rls_policy')
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sys.security_predicates p
    JOIN sys.tables t ON t.object_id = p.target_object_id
    WHERE p.type = N'FILTER'
      AND p.security_policy_id = OBJECT_ID(N'dbo.stratton_rls_policy')
      AND t.name = N'analysis_bundles'
  )
  BEGIN
    ALTER SECURITY POLICY dbo.stratton_rls_policy
      ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.analysis_bundles;
  END;
  IF NOT EXISTS (
    SELECT 1
    FROM sys.security_predicates p
    JOIN sys.tables t ON t.object_id = p.target_object_id
    WHERE p.type = N'BLOCK'
      AND p.operation_desc = N'AFTER INSERT'
      AND p.security_policy_id = OBJECT_ID(N'dbo.stratton_rls_policy')
      AND t.name = N'analysis_bundles'
  )
  BEGIN
    ALTER SECURITY POLICY dbo.stratton_rls_policy
      ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.analysis_bundles AFTER INSERT;
  END;
  IF NOT EXISTS (
    SELECT 1
    FROM sys.security_predicates p
    JOIN sys.tables t ON t.object_id = p.target_object_id
    WHERE p.type = N'BLOCK'
      AND p.operation_desc = N'AFTER UPDATE'
      AND p.security_policy_id = OBJECT_ID(N'dbo.stratton_rls_policy')
      AND t.name = N'analysis_bundles'
  )
  BEGIN
    ALTER SECURITY POLICY dbo.stratton_rls_policy
      ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.analysis_bundles AFTER UPDATE;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM sys.security_predicates p
    JOIN sys.tables t ON t.object_id = p.target_object_id
    WHERE p.type = N'FILTER'
      AND p.security_policy_id = OBJECT_ID(N'dbo.stratton_rls_policy')
      AND t.name = N'analysis_bundle_evidence'
  )
  BEGIN
    ALTER SECURITY POLICY dbo.stratton_rls_policy
      ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.analysis_bundle_evidence;
  END;
  IF NOT EXISTS (
    SELECT 1
    FROM sys.security_predicates p
    JOIN sys.tables t ON t.object_id = p.target_object_id
    WHERE p.type = N'BLOCK'
      AND p.operation_desc = N'AFTER INSERT'
      AND p.security_policy_id = OBJECT_ID(N'dbo.stratton_rls_policy')
      AND t.name = N'analysis_bundle_evidence'
  )
  BEGIN
    ALTER SECURITY POLICY dbo.stratton_rls_policy
      ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.analysis_bundle_evidence AFTER INSERT;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM sys.security_predicates p
    JOIN sys.tables t ON t.object_id = p.target_object_id
    WHERE p.type = N'FILTER'
      AND p.security_policy_id = OBJECT_ID(N'dbo.stratton_rls_policy')
      AND t.name = N'analysis_bundle_reviews'
  )
  BEGIN
    ALTER SECURITY POLICY dbo.stratton_rls_policy
      ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.analysis_bundle_reviews;
  END;
  IF NOT EXISTS (
    SELECT 1
    FROM sys.security_predicates p
    JOIN sys.tables t ON t.object_id = p.target_object_id
    WHERE p.type = N'BLOCK'
      AND p.operation_desc = N'AFTER INSERT'
      AND p.security_policy_id = OBJECT_ID(N'dbo.stratton_rls_policy')
      AND t.name = N'analysis_bundle_reviews'
  )
  BEGIN
    ALTER SECURITY POLICY dbo.stratton_rls_policy
      ADD BLOCK PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.analysis_bundle_reviews AFTER INSERT;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM sys.security_predicates p
    JOIN sys.tables t ON t.object_id = p.target_object_id
    WHERE p.type = N'FILTER'
      AND p.security_policy_id = OBJECT_ID(N'dbo.stratton_rls_policy')
      AND t.name = N'approved_model_route_evidence'
  )
  BEGIN
    ALTER SECURITY POLICY dbo.stratton_rls_policy
      ADD FILTER PREDICATE rls.fn_tenant_case(tenant_id, case_id) ON dbo.approved_model_route_evidence;
  END;
END;
GO

GRANT SELECT, INSERT, UPDATE ON dbo.analysis_bundles TO workload_api_role;
GRANT SELECT, INSERT ON dbo.analysis_bundle_evidence TO workload_api_role;
GRANT SELECT, INSERT ON dbo.analysis_bundle_reviews TO workload_api_role;
GRANT SELECT ON dbo.approved_model_route_evidence TO workload_api_role;

GRANT SELECT, INSERT, UPDATE ON dbo.analysis_bundles TO worker_runtime_role;
GRANT SELECT, INSERT ON dbo.analysis_bundle_evidence TO worker_runtime_role;
GRANT SELECT ON dbo.approved_model_route_evidence TO worker_runtime_role;
