BEGIN;

CREATE TABLE dressed.garment_categories (
  category_id uuid PRIMARY KEY,
  parent_category_id uuid REFERENCES dressed.garment_categories(category_id),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE NULLS NOT DISTINCT (parent_category_id, name)
);

CREATE TABLE dressed.garments (
  garment_id uuid PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES dressed.garment_categories(category_id),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  brand text,
  product_name text,
  sku text,
  notes text,
  formality smallint CHECK (formality BETWEEN 1 AND 5),
  fit text,
  size text,
  tailoring_notes text,
  acquisition_condition text CHECK (acquisition_condition IN ('new','used')),
  purchase_date date,
  purchase_price_minor bigint CHECK (purchase_price_minor >= 0),
  currency char(3) CHECK (currency ~ '^[A-Z]{3}$'),
  original_retail_price_minor bigint CHECK (original_retail_price_minor >= 0),
  source text,
  is_gift boolean NOT NULL DEFAULT false,
  acquisition_notes text,
  lifecycle_status text NOT NULL DEFAULT 'available' CHECK (lifecycle_status IN ('available','unavailable','archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  archived_at timestamptz
);

CREATE TABLE dressed.garment_materials (
  garment_id uuid NOT NULL REFERENCES dressed.garments(garment_id) ON DELETE CASCADE,
  material text NOT NULL CHECK (length(trim(material)) BETWEEN 1 AND 80),
  percentage numeric(5,2) CHECK (percentage > 0 AND percentage <= 100),
  PRIMARY KEY (garment_id, material)
);

CREATE TABLE dressed.garment_seasons (
  garment_id uuid NOT NULL REFERENCES dressed.garments(garment_id) ON DELETE CASCADE,
  season text NOT NULL CHECK (season IN ('spring','summer','autumn','winter','all-season')),
  PRIMARY KEY (garment_id, season)
);

CREATE TABLE dressed.garment_restrictions (
  garment_id uuid NOT NULL REFERENCES dressed.garments(garment_id) ON DELETE CASCADE,
  restriction text NOT NULL CHECK (length(trim(restriction)) BETWEEN 1 AND 240),
  PRIMARY KEY (garment_id, restriction)
);

CREATE TABLE dressed.garment_status_history (
  status_history_id uuid PRIMARY KEY,
  garment_id uuid NOT NULL REFERENCES dressed.garments(garment_id),
  previous_status text,
  new_status text NOT NULL,
  reason text NOT NULL,
  changed_at timestamptz NOT NULL
);

CREATE INDEX garment_categories_parent_idx ON dressed.garment_categories(parent_category_id, sort_order, name);
CREATE INDEX garments_browse_idx ON dressed.garments(lifecycle_status, category_id, name, garment_id);
CREATE INDEX garments_brand_idx ON dressed.garments(brand) WHERE brand IS NOT NULL;

INSERT INTO dressed.garment_categories (category_id,parent_category_id,name,slug,sort_order,created_at,updated_at) VALUES
('00000000-0000-4000-8000-000000000001',NULL,'Underwear / Base Layers','base-layers',10,now(),now()),
('00000000-0000-4000-8000-000000000002',NULL,'Tops','tops',20,now(),now()),
('00000000-0000-4000-8000-000000000003',NULL,'Bottoms','bottoms',30,now(),now()),
('00000000-0000-4000-8000-000000000004',NULL,'Tailoring','tailoring',40,now(),now()),
('00000000-0000-4000-8000-000000000005',NULL,'Neckwear','neckwear',50,now(),now()),
('00000000-0000-4000-8000-000000000006',NULL,'Pocket Accessories','pocket-accessories',60,now(),now()),
('00000000-0000-4000-8000-000000000007',NULL,'Footwear','footwear',70,now(),now()),
('00000000-0000-4000-8000-000000000008',NULL,'Belts','belts',80,now(),now()),
('00000000-0000-4000-8000-000000000009',NULL,'Outerwear','outerwear',90,now(),now()),
('00000000-0000-4000-8000-000000000010',NULL,'Accessories','accessories',100,now(),now());

WITH seed(parent_slug,name,slug,sort_order) AS (VALUES
('base-layers','Socks','socks',10),('base-layers','Boxers','boxers',20),('base-layers','Briefs','briefs',30),('base-layers','Undershirts','undershirts',40),('base-layers','Vests','vests',50),
('tops','T-shirts','t-shirts',10),('tops','Polo shirts','polo-shirts',20),('tops','Henley shirts','henley-shirts',30),('tops','Casual shirts','casual-shirts',40),('tops','Oxford shirts','oxford-shirts',50),('tops','Formal shirts','formal-shirts',60),('tops','Knitwear','knitwear',70),('tops','Sweaters','sweaters',80),('tops','Cardigans','cardigans',90),
('bottoms','Formal trousers','formal-trousers',10),('bottoms','Chinos','chinos',20),('bottoms','Jeans','jeans',30),('bottoms','Casual trousers','casual-trousers',40),('bottoms','Shorts','shorts',50),
('tailoring','Blazers','blazers',10),('tailoring','Sports jackets','sports-jackets',20),('tailoring','Suit jackets','suit-jackets',30),('tailoring','Suit trousers','suit-trousers',40),('tailoring','Waistcoats','waistcoats',50),('tailoring','Suits','suits',60),
('neckwear','Ties','ties',10),('neckwear','Bow ties','bow-ties',20),('neckwear','Cravats','cravats',30),
('pocket-accessories','Pocket squares','pocket-squares',10),
('footwear','Oxford shoes','oxford-shoes',10),('footwear','Derby shoes','derby-shoes',20),('footwear','Loafers','loafers',30),('footwear','Monk straps','monk-straps',40),('footwear','Boots','boots',50),('footwear','Sneakers','sneakers',60),('footwear','Other footwear','other-footwear',70),
('belts','Formal belts','formal-belts',10),('belts','Casual belts','casual-belts',20),
('outerwear','Coats','coats',10),('outerwear','Jackets','jackets',20),('outerwear','Rainwear','rainwear',30),
('accessories','Watches','watches',10),('accessories','Cufflinks','cufflinks',20),('accessories','Tie bars','tie-bars',30),('accessories','Scarves','scarves',40),('accessories','Hats','hats',50),('accessories','Other accessories','other-accessories',60)
)
INSERT INTO dressed.garment_categories (category_id,parent_category_id,name,slug,sort_order,created_at,updated_at)
SELECT (substr(md5('dressed-category:' || seed.slug),1,8)||'-'||substr(md5('dressed-category:' || seed.slug),9,4)||'-4'||substr(md5('dressed-category:' || seed.slug),14,3)||'-8'||substr(md5('dressed-category:' || seed.slug),18,3)||'-'||substr(md5('dressed-category:' || seed.slug),21,12))::uuid,
       parent.category_id,seed.name,seed.slug,seed.sort_order,now(),now()
FROM seed JOIN dressed.garment_categories parent ON parent.slug=seed.parent_slug;

COMMIT;
