-- signals.db — L0 信号层专用库
-- 职责：原始信号流 / 未处理池 / T0↔T1分类冲突 / 训练数据结构（E负责生命周期）

-- ── 未处理池（P三问失败 / 超时升级 / 规则未覆盖）─────────────────
CREATE TABLE IF NOT EXISTS unresolved_pool (
  id           TEXT PRIMARY KEY,
  layer        TEXT NOT NULL,            -- L0 / L1 / L2 / L3
  signal_type  TEXT NOT NULL,            -- p_gate_fail / timeout_escalation / rule_miss / diff_conflict
  signal_snapshot TEXT NOT NULL,         -- JSON：原始信号快照
  failure_reason  TEXT,                  -- P三问失败原因：from / what / target / timeout
  failure_detail  TEXT,                  -- JSON：详细失败上下文
  status          TEXT DEFAULT 'pending',-- pending / arbitrating / resolved
  created_at      INTEGER NOT NULL,
  resolved_at     INTEGER,
  resolved_by     TEXT,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_pool_layer_status ON unresolved_pool(layer, status);
CREATE INDEX IF NOT EXISTS idx_pool_created      ON unresolved_pool(created_at DESC);

-- ── T0↔T1 分类冲突（需人工裁定）─────────────────────────────────
CREATE TABLE IF NOT EXISTS classification_diff (
  id               TEXT PRIMARY KEY,
  layer            TEXT DEFAULT 'L0',
  signal_snapshot  TEXT NOT NULL,        -- JSON：输入信号完整快照
  t0_prediction    TEXT,                 -- JSON：{label, confidence, latency_ms}
  t1_prediction    TEXT,                 -- JSON：{label, confidence, latency_ms}
  human_label      TEXT,                 -- 人工裁定结果
  arbitrated_by    TEXT,                 -- user_id
  arbitrated_at    INTEGER,
  status           TEXT DEFAULT 'pending', -- pending / arbitrated
  added_to_training INTEGER DEFAULT 0,   -- 是否已加入训练集
  created_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_diff_status  ON classification_diff(status);
CREATE INDEX IF NOT EXISTS idx_diff_created ON classification_diff(created_at DESC);

-- ── 训练数据（E 负责生命周期，此处只定义结构）──────────────────────
-- 来源：人工裁定后自动写入，或 E 主动标注
CREATE TABLE IF NOT EXISTS training_records (
  id           TEXT PRIMARY KEY,
  source_type  TEXT NOT NULL,    -- classification_diff / human_label / correction
  source_id    TEXT NOT NULL,    -- 关联 classification_diff.id 或其他来源 id
  signal_snapshot TEXT NOT NULL,
  input_features  TEXT,          -- JSON：E 提取的特征向量
  label           TEXT NOT NULL, -- 最终确认标签
  label_source    TEXT NOT NULL, -- human / auto
  model_tier      TEXT,          -- T0 / T1（训练目标模型）
  layer           TEXT,
  prvse_tags      TEXT,          -- JSON array：E 的 PRVSE 语义标注
  reward_signal   REAL,          -- V reward vector value
  batch_id        TEXT,          -- E 分配的训练批次 ID
  exported_at     INTEGER,       -- 同步到 SubjectiveEgoneticsAI 的时间
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_training_batch   ON training_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_training_source  ON training_records(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_training_exported ON training_records(exported_at);
