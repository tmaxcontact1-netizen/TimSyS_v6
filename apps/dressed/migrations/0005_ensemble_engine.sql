BEGIN;

CREATE TABLE dressed.outfit_slots (
  slot_id text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL UNIQUE
);

CREATE TABLE dressed.category_slot_assignments (
  category_id uuid PRIMARY KEY REFERENCES dressed.garment_categories(category_id),
  slot_id text NOT NULL REFERENCES dressed.outfit_slots(slot_id)
);

CREATE TABLE dressed.context_slot_requirements (
  context_id uuid NOT NULL REFERENCES dressed.outfit_contexts(context_id),
  slot_id text NOT NULL REFERENCES dressed.outfit_slots(slot_id),
  requirement text NOT NULL CHECK (requirement IN ('required','optional')),
  minimum_items integer NOT NULL DEFAULT 0 CHECK (minimum_items >= 0),
  maximum_items integer NOT NULL DEFAULT 1 CHECK (maximum_items >= minimum_items),
  PRIMARY KEY(context_id,slot_id)
);

CREATE TABLE dressed.saved_outfits (
  outfit_id uuid PRIMARY KEY,
  name text NOT NULL,
  context_id uuid NOT NULL REFERENCES dressed.outfit_contexts(context_id),
  styling_evaluation_id uuid NOT NULL REFERENCES dressed.styling_evaluations(evaluation_id),
  calculated_score numeric(7,3) NOT NULL,
  calculated_grade char(1) CHECK (calculated_grade IN ('A','B','C')),
  user_grade char(1) CHECK (user_grade IN ('A','B','C')),
  explanation_snapshot jsonb NOT NULL,
  favourite boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE dressed.saved_outfit_items (
  outfit_id uuid NOT NULL REFERENCES dressed.saved_outfits(outfit_id),
  garment_id uuid NOT NULL REFERENCES dressed.garments(garment_id),
  slot_id text NOT NULL REFERENCES dressed.outfit_slots(slot_id),
  position integer NOT NULL,
  PRIMARY KEY(outfit_id,garment_id),
  UNIQUE(outfit_id,slot_id,position)
);

CREATE TABLE dressed.combination_overrides (
  override_id uuid PRIMARY KEY,
  override_type text NOT NULL CHECK (override_type IN ('ban','favourite')),
  scope text NOT NULL CHECK (scope IN ('exact_outfit','relationship')),
  garment_ids uuid[] NOT NULL CHECK (cardinality(garment_ids) >= 2),
  score_delta numeric(7,3) NOT NULL DEFAULT 0,
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL
);

CREATE INDEX combination_overrides_active_idx ON dressed.combination_overrides(override_type,is_active);
CREATE INDEX saved_outfits_context_idx ON dressed.saved_outfits(context_id,created_at DESC);

INSERT INTO dressed.outfit_slots(slot_id,name,sort_order) VALUES
('base_layer','Base layer',10),('socks','Socks',20),('top','Top / shirt',30),('bottom','Bottom',40),('belt','Belt',50),('footwear','Footwear',60),('jacket','Jacket / tailoring',70),('waistcoat','Waistcoat',80),('neckwear','Neckwear',90),('pocket_square','Pocket square',100),('outerwear','Outerwear',110),('accessory','Accessory',120);

INSERT INTO dressed.category_slot_assignments(category_id,slot_id)
SELECT category_id,slot_id FROM (SELECT category_id,CASE
 WHEN slug IN ('socks') THEN 'socks' WHEN slug IN ('boxers','briefs','undershirts','vests') THEN 'base_layer'
 WHEN slug IN ('t-shirts','polo-shirts','henley-shirts','casual-shirts','oxford-shirts','formal-shirts','knitwear','sweaters','cardigans') THEN 'top'
 WHEN slug IN ('formal-trousers','chinos','jeans','casual-trousers','shorts','suit-trousers') THEN 'bottom'
 WHEN slug IN ('blazers','sports-jackets','suit-jackets','suits') THEN 'jacket' WHEN slug='waistcoats' THEN 'waistcoat'
 WHEN slug IN ('ties','bow-ties','cravats') THEN 'neckwear' WHEN slug='pocket-squares' THEN 'pocket_square'
 WHEN slug IN ('oxford-shoes','derby-shoes','loafers','monk-straps','boots','sneakers','other-footwear') THEN 'footwear'
 WHEN slug IN ('formal-belts','casual-belts') THEN 'belt' WHEN slug IN ('coats','jackets','rainwear') THEN 'outerwear'
 WHEN slug IN ('watches','cufflinks','tie-bars','scarves','hats','other-accessories') THEN 'accessory' END AS slot_id
FROM dressed.garment_categories WHERE slug <> 'uncategorised') mapped WHERE slot_id IS NOT NULL
ON CONFLICT(category_id) DO NOTHING;

INSERT INTO dressed.context_slot_requirements(context_id,slot_id,requirement,minimum_items,maximum_items)
SELECT c.context_id,v.slot_id,v.requirement,v.minimum_items,v.maximum_items FROM dressed.outfit_contexts c CROSS JOIN (VALUES
('top','required',1,1),('bottom','required',1,1),('footwear','required',1,1),('belt','optional',0,1),('jacket','optional',0,1),('neckwear','optional',0,1),('pocket_square','optional',0,1),('outerwear','optional',0,1),('accessory','optional',0,3)
) AS v(slot_id,requirement,minimum_items,maximum_items);

COMMIT;
