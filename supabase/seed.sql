-- ============================================================
-- Stockwell Solar — Seed Data
-- Run AFTER schema.sql
-- ============================================================

-- ── Sites ──────────────────────────────────────────────────
insert into sites (name) values
  ('Raimalwara-1'),
  ('Raimalwara-2'),
  ('Raimalwara-3'),
  ('Muknasar'),
  ('Ajoliya Ka Khera'),
  ('Surawas'),
  ('Ghewariya'),
  ('Gajroopdesar-I A'),
  ('Sandwa'),
  ('Devliya Kallan'),
  ('SubiSarana'),
  ('Bamboo'),
  ('Thaiyat'),
  ('Ramdevra-1'),
  ('Gajroopdesar-I B'),
  ('Lalasar Sathri'),
  ('Sadu')
on conflict (name) do nothing;

-- ── Systems ────────────────────────────────────────────────
insert into systems (name, label) values
  ('Inverter',                    'inverter'),
  ('ACDB',                        'acdb'),
  ('Transformer',                 'transformer'),
  ('HT Panel',                    'ht_panel'),
  ('WMS',                         'wms'),
  ('Aux Transformer',             'aux_transformer'),
  ('SCADA',                       'scada'),
  ('PV Module',                   'pv_module'),
  ('LA',                          'la'),
  ('Table Alignment & Earthing',  'table_alignment'),
  ('AC Cable',                    'ac_cable'),
  ('DC Cable',                    'dc_cable'),
  ('Grid Earthing',               'grid_earthing'),
  ('Control Cable',               'control_cable'),
  ('MCR Room',                    'mcr_room'),
  ('Switchyard',                  'switchyard'),
  ('CCTV',                        'cctv'),
  ('Earthing System',             'earthing_system')
on conflict (label) do nothing;

-- ── Checklist Items ────────────────────────────────────────

-- INVERTER (41 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'Mounting check'),
  (2,  'Alignment and bolt tightness'),
  (3,  'Inverter body condition (no dents/scratches)'),
  (4,  'Site-specific inverter labeling (INV-01 etc.)'),
  (5,  'Sun-shade or canopy installed'),
  (6,  'Quality of canopy — is it stable'),
  (7,  'Quality of inverter stand — is it stable'),
  (8,  'Body earthing connection'),
  (9,  'Frame earthing'),
  (10, 'Stand earthing'),
  (11, 'RS485 cable shield earthing (at one end only)'),
  (12, 'AC cable armor earthing'),
  (13, 'Earth continuity test (<1Ω preferred)'),
  (14, 'Earthing connected with grid'),
  (15, 'AC cable crimping with correct OT/DT lugs'),
  (16, 'Proper torque on AC terminals'),
  (17, 'Heat shrink sleeve over crimping (no exposed aluminium)'),
  (18, 'Gland installation on AC cable'),
  (19, 'AC cable ferrule/tag at both ends'),
  (20, 'Phase sequence verified (RYB)'),
  (21, 'AC cable insulation test (IR test before energizing)'),
  (22, 'AC cable armor earthed at panel end'),
  (23, 'DC string polarity check for all strings'),
  (24, 'String VOC measured and within limits'),
  (25, 'String ISC verified'),
  (26, 'MC4 connector insertion and locking verified'),
  (27, 'DC cable labeling (string number, MPPT number)'),
  (28, 'DC fuse installation and rating check'),
  (29, 'RS485 cable connection to inverter'),
  (30, 'RS485 address set correctly (unique per inverter)'),
  (31, 'Communication cable shield earthed (one end)'),
  (32, 'SCADA data reading verified for this inverter'),
  (33, 'Safety signage on inverter'),
  (34, 'Warning labels and hazard stickers applied'),
  (35, 'Fire extinguisher near inverter location'),
  (36, 'PPE compliance during energization'),
  (37, 'Inverter power ON and display active'),
  (38, 'Inverter parameters configured as per design'),
  (39, 'Inverter generating power and syncing to grid'),
  (40, 'Fault/alarm status checked (no active faults)'),
  (41, 'Final test certificate signed off')
) as t(num, txt)
where s.label = 'inverter'
on conflict (system_id, item_number) do nothing;

-- ACDB (30 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'Physical inspection for panel body no dents or damages'),
  (2,  'Powder coating quality (no scratches peeling)'),
  (3,  'Enclosure fixing leveling foundation bolts tightness'),
  (4,  'Gland plate installation and PU foam sealing at cable entry'),
  (5,  'ACB make/model verification (ABB E4.2 3200A 3P LSIG)'),
  (6,  'ACB mechanical ON/OFF/spring charging operation test'),
  (7,  'ACB electrical trip testing (manual/relay based trip)'),
  (8,  'LSIG protection setting verification'),
  (9,  'ACB communication module RS485 check'),
  (10, 'ACB auxiliary contacts status for SCADA monitoring'),
  (11, 'Tightness check for ACB incoming and outgoing cables/busbar'),
  (12, 'MCCB make/model verification (ABB 320A 800V 9 nos.)'),
  (13, 'MCCB mechanical ON/OFF operation'),
  (14, 'MCCB terminal tightness (both incoming and outgoing)'),
  (15, 'Extended rotary handle proper installation (9 nos.)'),
  (16, 'Spreader links installation check for MCCB'),
  (17, 'MCCB auxiliary contacts wiring'),
  (18, 'MCCB make/model verification (ABB 125A 800V 1 no.)'),
  (19, 'MCCB mechanical and electrical operation test'),
  (20, 'CT polarity and ratio verification'),
  (21, 'Multifunction meter wiring and installation check'),
  (22, 'RS485 communication connection for SCADA'),
  (23, 'Initial meter reading recording'),
  (24, 'SPD proper installation check'),
  (25, 'Cooling fan with filter installation and running test'),
  (26, 'Earth busbar and panel body earthing continuity check'),
  (27, 'Earth pit resistance measurement (<5Ω)'),
  (28, 'SCADA alarm/status monitoring verification'),
  (29, 'Final cleaning of panel (inside and outside)'),
  (30, 'Client final walkthrough inspection')
) as t(num, txt)
where s.label = 'acdb'
on conflict (system_id, item_number) do nothing;

-- TRANSFORMER (30 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'Nameplate details match with specs'),
  (2,  'Transformer rating (kVA) verified'),
  (3,  'Voltage ratio (800V/33kV) verified'),
  (4,  'Vector group matches (Dyn11 etc.)'),
  (5,  'Transportation damage check'),
  (6,  'Verify IDT nameplate'),
  (7,  'Transportation locks removed'),
  (8,  'Air release from radiators bushings buchholz relay tank'),
  (9,  'Core material verified (CRGO/Amorphous)'),
  (10, 'Winding material (Cu/Al) verified'),
  (11, 'Tank finish/painting quality checked'),
  (12, 'Bushings type and rating verified'),
  (13, 'Gaskets and seals inspection'),
  (14, 'Conservator silica breather installed (colour check)'),
  (15, 'Radiator valve open'),
  (16, 'Radiators leak tested'),
  (17, 'Buchholz relay installed and connections checked'),
  (18, 'PRD (pressure relief device) installed'),
  (19, 'WTI/OTI thermometer installed and calibrated'),
  (20, 'Oil level indicator checked'),
  (21, 'Transformer oil BDV test >60kV'),
  (22, 'Oil leakage check (all joints radiators bushings)'),
  (23, 'HV bushing installation and connection verified'),
  (24, 'LV bushing installation and connection verified'),
  (25, 'HV cable termination and torque check'),
  (26, 'LV cable termination and torque check'),
  (27, 'Neutral earthing connection and resistance'),
  (28, 'Body earthing (2 nos.) and resistance <1Ω'),
  (29, 'IR test HV-LV HV-E LV-E before energizing'),
  (30, 'Transformer ratio test (TTR)')
) as t(num, txt)
where s.label = 'transformer'
on conflict (system_id, item_number) do nothing;

-- HT PANEL (20 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'Foundation integrity RCC/MS base properly levelled no cracks'),
  (2,  'Panel alignment plumb and level (spirit level check)'),
  (3,  'Anchor bolts grouted and tightened properly'),
  (4,  'Front clearance minimum 1500mm for VCB drawout'),
  (5,  'Drawout mechanism VCB drawout smooth without obstruction'),
  (6,  'Sealing of openings all unused cable gland holes sealed'),
  (7,  'Busbar inspection alignment support and no damage'),
  (8,  'Busbar insulation colour coded and insulated properly'),
  (9,  'CT/PT installation correct mounting and wiring'),
  (10, 'CT/PT polarity verified and correct'),
  (11, 'Protection relays installed as per specifications'),
  (12, 'Relay settings verified as per protection coordination study'),
  (13, 'Control wiring tagged routed properly'),
  (14, 'Cable termination proper lugs and crimping used'),
  (15, 'Earthing connections panel frame gland plate door earthing'),
  (16, 'VCB manual and remote operation close/trip tested'),
  (17, 'Interlocks mechanical and electrical verified'),
  (18, 'ON/OFF/TRIP indications working'),
  (19, 'Anti-pumping relay function tested'),
  (20, 'IR test HV side before energizing')
) as t(num, txt)
where s.label = 'ht_panel'
on conflict (system_id, item_number) do nothing;

-- WMS (19 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'Correct location as per drawing'),
  (2,  'Foundation as per drawing'),
  (3,  'Height as per drawing'),
  (4,  'All accessories installed as per drawing'),
  (5,  'Pyranometer installed as per spec (location direction height)'),
  (6,  'Temperature sensors installed cable termination done'),
  (7,  'Wind vane and anemometer installed cable termination done'),
  (8,  'Cables of correct type routed as per drawing/SLD'),
  (9,  'WMS terminal box location as per drawing'),
  (10, 'Panel 24V DC supply checked'),
  (11, 'Pyranometer and temperature sensor values checked'),
  (12, 'Cable supported and clamped below control box'),
  (13, 'Cables protected from physical damage'),
  (14, 'All cable terminations done as per manufacturer instruction'),
  (15, 'Cables correctly labelled as per drawing'),
  (16, 'Enclosure sealed to cover any openings or leaks'),
  (17, 'Enclosure cleaned out and vacuumed'),
  (18, 'Labels installed on enclosure as per drawing'),
  (19, 'Earthing done as per drawings/specifications')
) as t(num, txt)
where s.label = 'wms'
on conflict (system_id, item_number) do nothing;

-- AUX TRANSFORMER (15 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'Physical inspection of transformer body (no dents oil leaks damage)'),
  (2,  'Proper mounting on base/channel/frame'),
  (3,  'Alignment and fixing tightness (foundation bolts secured)'),
  (4,  'Gland plate installation and PU foam sealing at cable entry'),
  (5,  'Breather silica gel colour check (blue OK replace if pink/white)'),
  (6,  'Breather cup oil level check'),
  (7,  'LV side (415V) cable connection tightness'),
  (8,  'HV side (800V) cable connection tightness'),
  (9,  'Cable lug crimping and gland fixing check'),
  (10, 'Body earthing connections (2 nos.) continuity and tightness'),
  (11, 'Earth continuity and resistance measurement (<5Ω)'),
  (12, 'IR test LV-HV LV-E HV-E'),
  (13, 'Transformer ratio test (800V/415V verification)'),
  (14, 'No-load voltage measurement (primary and secondary)'),
  (15, 'Labeling/nomenclature on transformer body')
) as t(num, txt)
where s.label = 'aux_transformer'
on conflict (system_id, item_number) do nothing;

-- SCADA (19 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'SCADA panel physically installed and secured'),
  (2,  'Panel mounting verified with clearances'),
  (3,  'Control room clean dry ventilated and sealed from dust'),
  (4,  'All cable entries properly glanded and sealed'),
  (5,  'All SCADA cables inserted in conduit/PVC pipe'),
  (6,  'Pipes sealed with PU foam'),
  (7,  'Panel door earthing verified'),
  (8,  'Panel wiring dressing and routing as per standard'),
  (9,  'Panel earthing and grounding complete and verified'),
  (10, 'Earth pit resistance measured and within limits (<5Ω)'),
  (11, 'Shield earthing for all WMS and communication cables'),
  (12, 'Power supply within rated voltage range'),
  (13, '230V AC input and 24V DC output verified'),
  (14, 'UPS installed and functional'),
  (15, 'SMPS MCB SPD operational and earthed'),
  (16, 'Inverter communication RS485 checked'),
  (17, 'SCADA data from all inverters verified'),
  (18, 'Energy meter data integration verified'),
  (19, 'WMS data integration verified')
) as t(num, txt)
where s.label = 'scada'
on conflict (system_id, item_number) do nothing;

-- PV MODULE (17 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'Structure bolt/nut/washers as per drawing and tightened'),
  (2,  'Torque value for fasteners'),
  (3,  'Structure earthing at 2 places'),
  (4,  'Inter-module wiring neat and dressed'),
  (5,  'Modules without any breakage and discolouration'),
  (6,  'No debris left on the module'),
  (7,  'MC4 connectors properly connected'),
  (8,  'DC LA (Franklin rod) fixed properly'),
  (9,  'Check integrity of module JBs'),
  (10, 'Base plate grouting'),
  (11, 'PV modules cleaned and free of dust'),
  (12, 'No shading on modules during peak sun hours'),
  (13, 'Cable routing done through proper conduits/trays'),
  (14, 'Proper labeling of strings and module connections'),
  (15, 'Visual inspection of module glass and frame'),
  (16, 'No mismatch in module ratings within same string'),
  (17, 'Photographic documentation done for each block')
) as t(num, txt)
where s.label = 'pv_module'
on conflict (system_id, item_number) do nothing;

-- LA (18 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'LA quantity as per BOQ/drawings verified'),
  (2,  'LA physical condition (no cracks no deformities)'),
  (3,  'Support structure vertical alignment check'),
  (4,  'Counter available and healthy (reading 0000)'),
  (5,  'Base foundation size and depth as per drawing'),
  (6,  'Anchor bolts properly grouted and plumbed'),
  (7,  'Mast erection plumbed vertically (spirit level check)'),
  (8,  'LA installed at correct height (5 meters clear height)'),
  (9,  'Mast properly tightened at base plate and no sway'),
  (10, 'LA counter mounted properly (easy readable height)'),
  (11, 'All mechanical fasteners (bolts nuts) tightened'),
  (12, 'LA HV terminal properly connected to mast/conductor'),
  (13, 'Down conductor GI/copper strip connection tight'),
  (14, 'Earth connection to earth pit completed'),
  (15, 'Continuity check done between LA and earth pit'),
  (16, 'Earth resistance measured (<5 ohms)'),
  (17, 'Lightning counter tested'),
  (18, 'Earth resistance test readings recorded')
) as t(num, txt)
where s.label = 'la'
on conflict (system_id, item_number) do nothing;

-- TABLE ALIGNMENT & EARTHING (16 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'Tightness for structure all bolts'),
  (2,  'Tightness for PV module'),
  (3,  'Checking for alignment with all rows'),
  (4,  'Mounting check'),
  (5,  'Checking for piling'),
  (6,  'Checking for structure earthing'),
  (7,  'Checking for PV module earthing'),
  (8,  'Tightness for structure all earthing'),
  (9,  'Tightness for PV module earthing'),
  (10, 'Checking for all row earthing'),
  (11, 'DC polarity check (positive/negative) for all strings'),
  (12, 'MC4/connector tightness check'),
  (13, 'DC cable crimping and sleeving'),
  (14, 'DC cable tagging (string numbers MPPT numbers)'),
  (15, 'DC cable proper dressing'),
  (16, 'DC string VOC checked for all strings')
) as t(num, txt)
where s.label = 'table_alignment'
on conflict (system_id, item_number) do nothing;

-- AC CABLE (15 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'AC cable drum visual inspection (no physical damage no water ingress)'),
  (2,  'Cable size type (1.9/3.3kV 3C x 300 sqmm XLPE) verified'),
  (3,  'Cable insulation test certificate available'),
  (4,  'AC cable laid separately from DC cables'),
  (5,  'AC trench constructed as per approved trench sections'),
  (6,  'Sand bed (minimum 70mm) provided below and above cable'),
  (7,  'Brick protection layer laid above sand layer'),
  (8,  'Warning tape laid above brick layer before backfilling'),
  (9,  'Proper mechanical protection at road crossings (DWC pipe)'),
  (10, 'Route markers installed every 30m and at trench junctions'),
  (11, 'Proper dressing and clamping inside inverter room/ACDB'),
  (12, 'Minimum bending radius maintained (>12D for 3.3kV cables)'),
  (13, 'Phase-wise colour coding applied (RYB sleeves)'),
  (14, 'Termination with proper crimped lugs (aluminium compatible)'),
  (15, 'Heat shrinkable sleeves over terminations')
) as t(num, txt)
where s.label = 'ac_cable'
on conflict (system_id, item_number) do nothing;

-- DC CABLE (15 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'DC cable drum visual inspection (no damage no cuts)'),
  (2,  'Cable size and specification match project design'),
  (3,  'Cable insulation colour coding (red + black) checked'),
  (4,  'DC cable UV resistance and outdoor suitability confirmed'),
  (5,  'MC4 connectors factory crimped/certified'),
  (6,  'DC and AC cables routed in separate HDPE/DWC pipes'),
  (7,  'DC trench constructed as per approved drawings'),
  (8,  'Proper sand cushion below and above cables provided'),
  (9,  'Red warning tape installed 300mm above cables before backfilling'),
  (10, 'Cable route clean proper clamping at intervals'),
  (11, 'No sharp bends at trench and pipe exits (bending radius >6D)'),
  (12, 'Road crossing via DWC pipe confirmed before cable pulling'),
  (13, 'Cable pulling with proper socks no excessive pulling force'),
  (14, 'Separate trenches for DC main and AC cables maintained'),
  (15, 'Smooth entry into JB/inverter without sharp bends')
) as t(num, txt)
where s.label = 'dc_cable'
on conflict (system_id, item_number) do nothing;

-- GRID EARTHING (15 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'Earth pits as per drawing/specifications'),
  (2,  'Location and number of pits'),
  (3,  'Depth and distance of earth pits'),
  (4,  'Electrode copper coated size as per drawing'),
  (5,  'Earthing chemical compound as per drawing'),
  (6,  'Welded/nut-bolts/brazed connections at joints'),
  (7,  'Test link provided'),
  (8,  'Cover installed'),
  (9,  'Pit identification number fixed/painted'),
  (10, 'Earth strip size as per drawing'),
  (11, 'Welded joint must be proper and no air gap'),
  (12, 'Painting of joints as per drawing'),
  (13, 'Tightness for bolted joints with torque wrench'),
  (14, 'Earth pits interlinked with strip'),
  (15, 'Contact surfaces free from non-conducting materials')
) as t(num, txt)
where s.label = 'grid_earthing'
on conflict (system_id, item_number) do nothing;

-- CONTROL CABLE (14 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'Check for physical damage of the cables'),
  (2,  'Check cable make size voltage grade conductor and insulation type'),
  (3,  'Check cable route as per drawing'),
  (4,  'Adequate looping at the termination ends'),
  (5,  'Check that DWC (piece) should be sealed'),
  (6,  'Check for proper dressing of the cables'),
  (7,  'Check the cables should be laid on blocks'),
  (8,  'Check tightness of cable terminations at connection'),
  (9,  'Check cable gland tightening to cover any opening'),
  (10, 'Check ferruling as per drawing'),
  (11, 'Check cable tag as per drawing'),
  (12, 'Check insulation resistance before and after laying'),
  (13, 'Verify continuity and correctness of core identification'),
  (14, 'Ensure proper separation between power and control cables')
) as t(num, txt)
where s.label = 'control_cable'
on conflict (system_id, item_number) do nothing;

-- MCR ROOM (15 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'MCR building structure completed'),
  (2,  'Floor finished dust-free and clean'),
  (3,  'Doors and windows properly fitted'),
  (4,  'Room ventilation and exhaust fans functional'),
  (5,  'AC units installed and operational'),
  (6,  'All SCADA panels installed and labeled'),
  (7,  'UPS installed and tested (including backup time)'),
  (8,  'Earthing connections provided to all panels'),
  (9,  'Light fixtures installed and working'),
  (10, 'Emergency lighting provided'),
  (11, 'Cables properly dressed and tagged'),
  (12, 'SCADA hardware installation completed'),
  (13, 'SCADA software installed and configured'),
  (14, 'Data communication with inverters confirmed'),
  (15, 'Remote monitoring system tested')
) as t(num, txt)
where s.label = 'mcr_room'
on conflict (system_id, item_number) do nothing;

-- SWITCHYARD (15 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'Foundation for equipment completed as per drawing'),
  (2,  'Earth mat laid and continuity checked'),
  (3,  'Equipment installed at correct position and level'),
  (4,  'CTs and PTs installed and connections verified'),
  (5,  'Breaker installation completed and aligned'),
  (6,  'Isolators installed and interlocked properly'),
  (7,  'LA (lightning arrestors) installed and earthed properly'),
  (8,  'Bus bar and jumpers installed and tightened'),
  (9,  'Cable trenches completed and covered'),
  (10, 'Cables dressed and terminated correctly'),
  (11, 'Control wiring completed and tested'),
  (12, 'Protection relays tested and configured'),
  (13, 'Proper signage and equipment labeling done'),
  (14, 'Insulation resistance test completed'),
  (15, 'Final inspection and approval received')
) as t(num, txt)
where s.label = 'switchyard'
on conflict (system_id, item_number) do nothing;

-- CCTV (12 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'Check correctness of foundation and foundation bolt'),
  (2,  'Mounting pole vertically straight and fixed properly'),
  (3,  'CCTV installed and properly fixed with assembly'),
  (4,  'Check cable make size voltage grade as per drawing'),
  (5,  'Check for any physical damage in cable'),
  (6,  'Check cable route depth and width of trench as per drawings'),
  (7,  'No twists knots or kinks'),
  (8,  'Check for proper dressing of cables'),
  (9,  'IP65 box for interconnection above 1m from NGL'),
  (10, 'Cable jointing and terminations done as per manufacturer manual'),
  (11, 'Tightness of cable terminations at connection points'),
  (12, 'Check for earthing connections provided')
) as t(num, txt)
where s.label = 'cctv'
on conflict (system_id, item_number) do nothing;

-- EARTHING SYSTEM (14 items)
insert into checklist_items (system_id, item_number, description)
select s.id, t.num, t.txt from systems s,
(values
  (1,  'Earth pit electrode installation verified'),
  (2,  'EP value with grid measured and recorded'),
  (3,  'EP value without grid measured and recorded'),
  (4,  'Earth pit cover installed and OK'),
  (5,  'Test link provided and accessible'),
  (6,  'Pit identification number fixed/painted'),
  (7,  'Earth pits interlinked with strip'),
  (8,  'Strip welded joints proper no air gap'),
  (9,  'Painting of strip joints done'),
  (10, 'Torque checked on bolted joints'),
  (11, 'LA earth pit separate and not connected to main grid'),
  (12, 'Chemical earthing compound used as per spec'),
  (13, 'Cover box properly fitted over each pit'),
  (14, 'All pit readings documented')
) as t(num, txt)
where s.label = 'earthing_system'
on conflict (system_id, item_number) do nothing;
