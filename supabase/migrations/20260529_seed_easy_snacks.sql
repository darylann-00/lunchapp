-- Seed a catalog of low-effort snacks: packaged grab-and-go items and very-easy
-- assemble-only options. Counters the existing snack pool skewing high-effort.
-- No brand names. prep_time_minutes reflects realistic lunch-packing time
-- (opening a wrapper ~1 min; boiling an egg ~15 min including cool/peel).
-- Global curated rows (created_by = null → visible to all users via RLS).

INSERT INTO recipes (name, description, prep_notes, ingredients, meal_type, is_packaged, prep_time_minutes, source)
VALUES
  -- ── Packaged / grab-and-go ──────────────────────────────────────────────
  (
    'String Cheese',
    'A peelable stick of mild mozzarella',
    'Drop one sealed stick into the lunchbox. Keep cool until lunch.',
    '[{"name":"string cheese","quantity":"1","unit":"stick"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Cheese Stick',
    'An individually wrapped cheese stick',
    'Pack one wrapped stick. Keep cool until lunch.',
    '[{"name":"cheese stick","quantity":"1","unit":"stick"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Mini Cheese Rounds',
    'Small wax-wrapped rounds of semi-soft cheese',
    'Pack one or two wrapped rounds. Keep cool until lunch.',
    '[{"name":"mini cheese rounds","quantity":"2","unit":"pieces"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Applesauce Pouch',
    'A squeezable pouch of unsweetened applesauce',
    'Pack one sealed pouch. No spoon needed.',
    '[{"name":"applesauce pouch","quantity":"1","unit":"pouch"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Yogurt Tube',
    'A freezable tube of low-sugar yogurt',
    'Pack one tube straight from the fridge or freezer; it thaws by lunch.',
    '[{"name":"yogurt tube","quantity":"1","unit":"tube"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Yogurt Cup',
    'A single-serve cup of yogurt',
    'Pack one sealed cup with a spoon. Keep cool until lunch.',
    '[{"name":"yogurt cup","quantity":"1","unit":"cup"},{"name":"spoon","quantity":"1","unit":"piece"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Cheese and Cracker Pack',
    'A pre-portioned tray of crackers with cheese spread',
    'Pack one sealed tray. Keep cool until lunch.',
    '[{"name":"cheese and cracker pack","quantity":"1","unit":"tray"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Pretzels',
    'A small portion of crunchy pretzels',
    'Portion about a handful into a small container or bag.',
    '[{"name":"pretzels","quantity":"1/2","unit":"cup"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Veggie Straws',
    'Light, crunchy potato-and-vegetable straws',
    'Portion a handful into a small container or bag.',
    '[{"name":"veggie straws","quantity":"1","unit":"oz"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Pea Crisps',
    'Crunchy baked snap-pea crisps',
    'Portion a handful into a small container or bag.',
    '[{"name":"pea crisps","quantity":"1","unit":"oz"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Popcorn',
    'A serving of ready-popped lightly salted popcorn',
    'Portion popped popcorn into a small bag or container.',
    '[{"name":"popped popcorn","quantity":"1","unit":"cup"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Freeze-Dried Fruit',
    'Crisp, airy freeze-dried fruit pieces',
    'Pack one sealed single-serve bag, or portion into a small container.',
    '[{"name":"freeze-dried fruit","quantity":"1","unit":"bag"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Fruit Leather',
    'A rolled sheet of pressed fruit',
    'Pack one wrapped piece.',
    '[{"name":"fruit leather","quantity":"1","unit":"piece"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Fruit Strips',
    'Thin strips of pressed fruit',
    'Pack one wrapped strip.',
    '[{"name":"fruit strip","quantity":"1","unit":"strip"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Raisins',
    'A small box of seedless raisins',
    'Pack one mini box, or portion into a small container.',
    '[{"name":"raisins","quantity":"1","unit":"box"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Dried Fruit Mix',
    'A mix of bite-sized dried fruit',
    'Portion into a small container or pack a sealed single-serve bag.',
    '[{"name":"dried fruit mix","quantity":"1/4","unit":"cup"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Granola Bar',
    'A soft or crunchy oat-based bar',
    'Pack one wrapped bar.',
    '[{"name":"granola bar","quantity":"1","unit":"bar"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Cereal Bar',
    'A soft fruit-filled cereal bar',
    'Pack one wrapped bar.',
    '[{"name":"cereal bar","quantity":"1","unit":"bar"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Rice Cakes',
    'Light, crisp mini rice cakes',
    'Pack a few mini cakes in a small container or sealed bag.',
    '[{"name":"mini rice cakes","quantity":"5","unit":"pieces"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Roasted Chickpeas',
    'Crunchy seasoned roasted chickpeas',
    'Pack a sealed single-serve bag, or portion into a small container.',
    '[{"name":"roasted chickpeas","quantity":"1/4","unit":"cup"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Trail Mix',
    'A nut-free mix of seeds, dried fruit, and cereal',
    'Portion into a small container or pack a sealed single-serve bag.',
    '[{"name":"nut-free trail mix","quantity":"1/4","unit":"cup"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Seed Mix',
    'A roasted mix of pumpkin and sunflower seeds',
    'Portion into a small container or pack a sealed single-serve bag.',
    '[{"name":"seed mix","quantity":"1/4","unit":"cup"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Hummus and Pretzel Cup',
    'A single-serve cup of hummus with pretzels',
    'Pack one sealed cup. Keep cool until lunch.',
    '[{"name":"hummus and pretzel cup","quantity":"1","unit":"cup"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Olives Cup',
    'A single-serve cup of pitted olives',
    'Pack one sealed, drained cup.',
    '[{"name":"olives cup","quantity":"1","unit":"cup"}]',
    'snack', true, 1, 'curated'
  ),
  (
    'Guacamole Cup',
    'A single-serve cup of guacamole',
    'Pack one sealed cup. Keep cool until lunch. Good with crackers or veggie sticks.',
    '[{"name":"guacamole cup","quantity":"1","unit":"cup"}]',
    'snack', true, 1, 'curated'
  ),

  -- ── Very easy / assemble-only (no cooking) ──────────────────────────────
  (
    'Apple Slices',
    'Fresh crisp apple wedges',
    'Core and slice into 8 wedges. Pack in a small lidded container.',
    '[{"name":"apple","quantity":"1","unit":"medium"}]',
    'snack', false, 3, 'curated'
  ),
  (
    'Baby Carrots with Ranch',
    'Crunchy baby carrots with a ranch dip cup',
    'Rinse and pat carrots dry. Pack with a small lidded cup of ranch dip.',
    '[{"name":"baby carrots","quantity":"1/2","unit":"cup"},{"name":"ranch dip","quantity":"2","unit":"tbsp"}]',
    'snack', false, 3, 'curated'
  ),
  (
    'Cucumber Rounds',
    'Cool, crisp cucumber slices',
    'Wash and slice into rounds about 1/4 inch thick. Pack in a small container.',
    '[{"name":"cucumber","quantity":"1/3","unit":"medium"}]',
    'snack', false, 3, 'curated'
  ),
  (
    'Cherry Tomatoes',
    'Sweet bite-sized tomatoes',
    'Rinse and dry. Pack whole, or halve for younger kids.',
    '[{"name":"cherry tomatoes","quantity":"1/4","unit":"cup"}]',
    'snack', false, 2, 'curated'
  ),
  (
    'Grapes',
    'A small bunch of seedless grapes',
    'Rinse and remove stems. Halve lengthwise for younger kids to avoid choking.',
    '[{"name":"grapes","quantity":"1/2","unit":"cup"}]',
    'snack', false, 4, 'curated'
  ),
  (
    'Mandarin Segments',
    'Sweet, easy-peel mandarin segments',
    'Peel and separate into segments. Pack in a small container.',
    '[{"name":"mandarin","quantity":"1","unit":"small"}]',
    'snack', false, 3, 'curated'
  ),
  (
    'Banana',
    'A whole ripe banana',
    'Pack whole, unpeeled. Optionally label or pick one without bruises.',
    '[{"name":"banana","quantity":"1","unit":"medium"}]',
    'snack', false, 1, 'curated'
  ),
  (
    'Mixed Berries',
    'Fresh blueberries and raspberries',
    'Rinse gently and pat dry. Pack in a small lidded container.',
    '[{"name":"blueberries","quantity":"1/4","unit":"cup"},{"name":"raspberries","quantity":"1/4","unit":"cup"}]',
    'snack', false, 3, 'curated'
  ),
  (
    'Cheese Cubes with Crackers',
    'Bite-sized cheddar cubes with a few crackers',
    'Cut cheese into 1-inch cubes. Pack with about 6 crackers in a divided container.',
    '[{"name":"cheddar cheese","quantity":"1","unit":"oz"},{"name":"crackers","quantity":"6","unit":"pieces"}]',
    'snack', false, 4, 'curated'
  ),
  (
    'Hard-Boiled Egg',
    'A peeled hard-boiled egg',
    'Boil eggs 10-12 minutes, cool in cold water, then peel. Pack whole or halved. Batch-cook ahead to save time.',
    '[{"name":"egg","quantity":"1","unit":"large"}]',
    'snack', false, 15, 'curated'
  ),
  (
    'Edamame',
    'Steamed edamame served cold',
    'Steam or boil shelled or in-pod edamame about 5 minutes, then cool. Pack cold.',
    '[{"name":"edamame","quantity":"1/2","unit":"cup"}]',
    'snack', false, 7, 'curated'
  ),
  (
    'Sugar Snap Peas',
    'Crisp, sweet whole snap peas',
    'Rinse and pat dry. Pack whole in a small container.',
    '[{"name":"sugar snap peas","quantity":"1/2","unit":"cup"}]',
    'snack', false, 3, 'curated'
  ),
  (
    'Bell Pepper Strips',
    'Sweet, colorful pepper strips',
    'Wash, seed, and slice into strips. Pack in a small container.',
    '[{"name":"bell pepper","quantity":"1/2","unit":"medium"}]',
    'snack', false, 4, 'curated'
  ),
  (
    'Pretzel and Cheese Cube Combo',
    'A few pretzels with bite-sized cheese cubes',
    'Cut cheese into 1-inch cubes. Pack with a small handful of pretzels in a divided container.',
    '[{"name":"pretzels","quantity":"1/4","unit":"cup"},{"name":"cheddar cheese","quantity":"1","unit":"oz"}]',
    'snack', false, 3, 'curated'
  ),
  (
    'Cheese and Cracker Stackers',
    'Crackers with thin slices of cheese for stacking',
    'Slice cheese thin enough to top a cracker. Pack about 6 crackers and matching cheese slices separately so crackers stay crisp.',
    '[{"name":"crackers","quantity":"6","unit":"pieces"},{"name":"cheese slices","quantity":"2","unit":"slices"}]',
    'snack', false, 4, 'curated'
  ),
  (
    'Cottage Cheese with Fruit',
    'A cup of cottage cheese topped with fresh fruit',
    'Spoon cottage cheese into a lidded cup and top with a little chopped fruit. Pack a spoon. Keep cool until lunch.',
    '[{"name":"cottage cheese","quantity":"1/2","unit":"cup"},{"name":"chopped fruit","quantity":"1/4","unit":"cup"},{"name":"spoon","quantity":"1","unit":"piece"}]',
    'snack', false, 4, 'curated'
  ),
  (
    'Crackers with Sunflower Seed Butter',
    'Crackers with a school-safe seed butter for spreading',
    'Pack about 6 crackers with a small lidded cup of sunflower seed butter for spreading, or spread ahead and sandwich pairs.',
    '[{"name":"crackers","quantity":"6","unit":"pieces"},{"name":"sunflower seed butter","quantity":"2","unit":"tbsp"}]',
    'snack', false, 3, 'curated'
  );
