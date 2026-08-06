IF OBJECT_ID(N'dbo.demo_scenario_projection', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.demo_scenario_projection
    (
        tenant_id NVARCHAR(128) NOT NULL,
        case_id NVARCHAR(128) NOT NULL,
        state_json NVARCHAR(MAX) NOT NULL,
        row_version BIGINT NOT NULL CONSTRAINT DF_demo_scenario_projection_row_version DEFAULT (0),
        updated_at DATETIME2(7) NOT NULL CONSTRAINT DF_demo_scenario_projection_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_demo_scenario_projection PRIMARY KEY CLUSTERED (tenant_id, case_id),
        CONSTRAINT CK_demo_scenario_projection_state_json CHECK (ISJSON(state_json) = 1)
    );
END;
