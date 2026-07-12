-- DuckDB queries that materialize the reviewed report datasets from comparison-data.json.

-- score_evolution
SELECT item.*
FROM read_json_auto('outputs/h5-mvp/fridge-radar-4model-20260711/comparison-data.json') AS source
CROSS JOIN UNNEST(source.scoreEvolution) AS row(item);

-- scenario_coverage
SELECT item.*
FROM read_json_auto('outputs/h5-mvp/fridge-radar-4model-20260711/comparison-data.json') AS source
CROSS JOIN UNNEST(source.scenarioCoverage) AS row(item);

-- provider_outcomes
SELECT item.*
FROM read_json_auto('outputs/h5-mvp/fridge-radar-4model-20260711/comparison-data.json') AS source
CROSS JOIN UNNEST(source.providerOutcomes) AS row(item);

-- report_quality
SELECT item.*
FROM read_json_auto('outputs/h5-mvp/fridge-radar-4model-20260711/comparison-data.json') AS source
CROSS JOIN UNNEST(source.reportQuality) AS row(item);

-- actions
SELECT item.*
FROM read_json_auto('outputs/h5-mvp/fridge-radar-4model-20260711/comparison-data.json') AS source
CROSS JOIN UNNEST(source.actions) AS row(item);
