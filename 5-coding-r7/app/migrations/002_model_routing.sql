SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

IF COL_LENGTH('dbo.analysis_runs', 'model_task_class') IS NULL
BEGIN
  ALTER TABLE dbo.analysis_runs ADD model_task_class NVARCHAR(64) NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'model_tier') IS NULL
BEGIN
  ALTER TABLE dbo.analysis_runs ADD model_tier NVARCHAR(16) NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'model_route_reason') IS NULL
BEGIN
  ALTER TABLE dbo.analysis_runs ADD model_route_reason NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'model_reasoning_effort') IS NULL
BEGIN
  ALTER TABLE dbo.analysis_runs ADD model_reasoning_effort NVARCHAR(16) NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'model_routing_policy_version') IS NULL
BEGIN
  ALTER TABLE dbo.analysis_runs ADD model_routing_policy_version NVARCHAR(64) NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'deployment_residency_evidence_id') IS NULL
BEGIN
  ALTER TABLE dbo.analysis_runs ADD deployment_residency_evidence_id NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'model_name') IS NULL
BEGIN
  ALTER TABLE dbo.analysis_runs ADD model_name NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'model_version') IS NULL
BEGIN
  ALTER TABLE dbo.analysis_runs ADD model_version NVARCHAR(64) NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'model_validation_status') IS NULL
BEGIN
  ALTER TABLE dbo.analysis_runs ADD model_validation_status NVARCHAR(16) NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'model_latency_milliseconds') IS NULL
BEGIN
  ALTER TABLE dbo.analysis_runs ADD model_latency_milliseconds BIGINT NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'model_input_tokens') IS NULL
BEGIN
  ALTER TABLE dbo.analysis_runs ADD model_input_tokens BIGINT NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'model_output_tokens') IS NULL
BEGIN
  ALTER TABLE dbo.analysis_runs ADD model_output_tokens BIGINT NULL;
END;
GO

IF COL_LENGTH('dbo.analysis_runs', 'model_observed_cost_usd') IS NULL
BEGIN
  ALTER TABLE dbo.analysis_runs ADD model_observed_cost_usd DECIMAL(18, 6) NULL;
END;
GO

UPDATE dbo.analysis_runs
SET model_task_class = COALESCE(model_task_class, N'GROUNDED_ANALYSIS'),
    model_tier = COALESCE(model_tier, N'TERRA'),
    model_route_reason = COALESCE(model_route_reason, N'HISTORICAL_PRE_CC_002'),
    model_reasoning_effort = COALESCE(model_reasoning_effort, N'medium'),
    model_routing_policy_version = COALESCE(model_routing_policy_version, N'pre-cc-002'),
    deployment_residency_evidence_id =
      COALESCE(deployment_residency_evidence_id, regional_deployment_evidence_id),
    model_name = COALESCE(model_name, N'historical-unknown'),
    model_version = COALESCE(model_version, N'historical-unknown'),
    model_validation_status = COALESCE(model_validation_status, N'NOT_RUN')
WHERE model_task_class IS NULL
   OR model_tier IS NULL
   OR model_route_reason IS NULL
   OR model_reasoning_effort IS NULL
   OR model_routing_policy_version IS NULL
   OR deployment_residency_evidence_id IS NULL
   OR model_name IS NULL
   OR model_version IS NULL
   OR model_validation_status IS NULL;
GO

IF EXISTS (
  SELECT 1
  FROM dbo.analysis_runs
  WHERE model_task_class IS NULL
     OR model_tier IS NULL
     OR model_route_reason IS NULL
     OR model_reasoning_effort IS NULL
     OR model_routing_policy_version IS NULL
     OR deployment_residency_evidence_id IS NULL
     OR model_name IS NULL
     OR model_version IS NULL
     OR model_validation_status IS NULL
)
BEGIN
  THROW 51000, 'MODEL_ROUTING_BACKFILL_INCOMPLETE', 1;
END;
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'model_task_class'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE dbo.analysis_runs ALTER COLUMN model_task_class NVARCHAR(64) NOT NULL;
END;
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'model_tier'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE dbo.analysis_runs ALTER COLUMN model_tier NVARCHAR(16) NOT NULL;
END;
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'model_route_reason'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE dbo.analysis_runs ALTER COLUMN model_route_reason NVARCHAR(128) NOT NULL;
END;
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'model_reasoning_effort'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE dbo.analysis_runs ALTER COLUMN model_reasoning_effort NVARCHAR(16) NOT NULL;
END;
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'model_routing_policy_version'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE dbo.analysis_runs ALTER COLUMN model_routing_policy_version NVARCHAR(64) NOT NULL;
END;
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'deployment_residency_evidence_id'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE dbo.analysis_runs
    ALTER COLUMN deployment_residency_evidence_id NVARCHAR(128) NOT NULL;
END;
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'model_name'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE dbo.analysis_runs ALTER COLUMN model_name NVARCHAR(128) NOT NULL;
END;
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'model_version'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE dbo.analysis_runs ALTER COLUMN model_version NVARCHAR(64) NOT NULL;
END;
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'model_validation_status'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE dbo.analysis_runs ALTER COLUMN model_validation_status NVARCHAR(16) NOT NULL;
END;
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'regional_deployment_evidence_id'
    AND is_nullable = 0
)
BEGIN
  ALTER TABLE dbo.analysis_runs
    ALTER COLUMN regional_deployment_evidence_id NVARCHAR(128) NULL;
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'CK_analysis_model_tier'
)
BEGIN
  ALTER TABLE dbo.analysis_runs WITH CHECK
    ADD CONSTRAINT CK_analysis_model_tier
      CHECK (model_tier IN (N'LUNA', N'TERRA', N'SOL'));
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'CK_analysis_model_reasoning_effort'
)
BEGIN
  ALTER TABLE dbo.analysis_runs WITH CHECK
    ADD CONSTRAINT CK_analysis_model_reasoning_effort
      CHECK (model_reasoning_effort IN (N'low', N'medium', N'high'));
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.analysis_runs')
    AND name = N'CK_analysis_model_validation_status'
)
BEGIN
  ALTER TABLE dbo.analysis_runs WITH CHECK
    ADD CONSTRAINT CK_analysis_model_validation_status
      CHECK (model_validation_status IN (N'NOT_RUN', N'PASS', N'FAIL'));
END;
GO
