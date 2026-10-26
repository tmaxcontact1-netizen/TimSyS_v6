BEGIN;
ALTER TABLE dressed.garments ADD COLUMN visual_style jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(visual_style)='object');
INSERT INTO dressed.outfit_slots(slot_id,name,sort_order) VALUES
('headwear','Hats / caps',130),
('eyewear','Glasses / sunglasses',140),
('watch','Watches',150),
('bracelet','Bracelets',160),
('ring','Rings',170),
('cufflinks','Cufflinks',180),
('tie_clip','Tie clips',190),
('lapel_pin','Lapel pins / brooches',200),
('scarf','Scarves',210),
('gloves','Gloves',220),
('bag','Bags',230),
('necklace','Necklaces',240),
('earrings','Earrings',250),
('suspenders','Suspenders',260),
('umbrella','Umbrellas',270) ON CONFLICT(slot_id) DO NOTHING;
INSERT INTO dressed.garment_categories(category_id,parent_category_id,name,slug,sort_order,created_at,updated_at)
SELECT gen_random_uuid(),p.category_id,v.name,v.slug,v.ord,now(),now() FROM dressed.garment_categories p CROSS JOIN (VALUES
('Glasses','glasses',70),
('Sunglasses','sunglasses',80),
('Bracelets','bracelets',90),
('Rings','rings',100),
('Lapel pins','lapel-pins',110),
('Brooches','brooches',120),
('Gloves','gloves',130),
('Bags','bags',140),
('Necklaces','necklaces',150),
('Earrings','earrings',160),
('Suspenders / braces','suspenders',170),
('Umbrellas','umbrellas',180)) v(name,slug,ord) WHERE p.slug='accessories' ON CONFLICT(slug) DO NOTHING;
INSERT INTO dressed.category_slot_assignments(category_id,slot_id) SELECT c.category_id,v.slot FROM dressed.garment_categories c JOIN (VALUES
('hats','headwear'),
('glasses','eyewear'),
('sunglasses','eyewear'),
('watches','watch'),
('bracelets','bracelet'),
('rings','ring'),
('cufflinks','cufflinks'),
('tie-bars','tie_clip'),
('lapel-pins','lapel_pin'),
('brooches','lapel_pin'),
('scarves','scarf'),
('gloves','gloves'),
('bags','bag'),
('necklaces','necklace'),
('earrings','earrings'),
('suspenders','suspenders'),
('umbrellas','umbrella')) v(slug,slot) ON c.slug=v.slug ON CONFLICT(category_id) DO UPDATE SET slot_id=EXCLUDED.slot_id;
INSERT INTO dressed.context_slot_requirements(context_id,slot_id,requirement,minimum_items,maximum_items) SELECT c.context_id,s.slot_id,'optional',0,1 FROM dressed.outfit_contexts c CROSS JOIN dressed.outfit_slots s WHERE s.sort_order>=130 ON CONFLICT DO NOTHING;
COMMIT;
