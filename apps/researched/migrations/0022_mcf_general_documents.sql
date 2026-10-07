-- Add a neutral intake mode without relabelling historical datasets.
ALTER TABLE researched.mcf_datasets DROP CONSTRAINT mcf_datasets_mode_check;
ALTER TABLE researched.mcf_datasets ADD CONSTRAINT mcf_datasets_mode_check CHECK(mode IN ('reviews','documentary','general'));
