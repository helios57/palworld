# Источники данных

Версия игры: **Palworld 1.0** (релиз 10 июля 2026). Дата актуализации базы: **2026-07-17**.

## Мутация: вид мутанта ≠ вид пары (2026-07-20, замер игрока + комьюнити)

- **Player-verified: Orserk×Orserk → мутант ВСЕГДА Aegidron.** Подтверждает palmods.gg
  («separate mutation species-selection branch — результат не обязан совпадать с обычным
  ребёнком пары»; правило не датамайнено) и комьюнити-паттерн (PalHatch): ранг мутанта не
  слабее обычного ребёнка (0 исключений), вид из генерик-пула; топ-пары мутируют в АЛЬФУ
  своего вида (Aegidron→Alpha Aegidron ×10, Whalaska→Alpha Whalaska). Гипотеза «paldeck ID
  + оффсет» опровергнута (разброс −62..+145). Наш ранговый разбор объясняет кейс Orserk:
  между рангом 120 и топом в генерик-пуле ровно один вид — Aegidron (30). PRELIMINARY.
- Следствие (исправлена моя ошибка в boss_fighting §5): same-species-only видам (Orserk/
  Jetragon/легендарки) радужные пассивки мутацией НЕ занести; радужно-способный универсал —
  Aegidron (кросс-комбы + мутация в альфу своего вида). palbreeder.com («мутант = тот же вид»)
  противоречит живому опыту — помечен устаревшим.

## Конденсация 1.0: раскладка по звёздам 4/8/12/24 (2026-07-20, замер игрока)

- **Игрок замерил в игре: 1★=4, 2★=8, 3★=12, 4★=24** → ровно 48 копий-корма (сумма сходится
  с патч-константой 48 из palmods/nexttier — независимая перекрёстная проверка). Кипер отдельно:
  глосс palmods «кипер+47» был их неверной интерпретацией. Мутант (2★) → остаток 12+24=36.
  В вебе/гуглe раскладки ещё нет (вики отдают старые 4/16/32/64) — источник: player-verified.

## Конденсация 1.0: 116 → 48 (2026-07-20, исправление ошибки)

- Игрок указал на косяк; перепроверено. **1.0 СНИЗИЛА стоимость конденсации со 116 до 48**
  (кипер + 47 копий-корма до 4★) — palmods.gg 1.0-датасет («verified constant»), nexttier
  1.0 patch notes. Плюс: макс-ранг за ОДИН синтез; прогресс конденсации копится в самом пале.
  Раскладка по звёздам в 1.0 не опубликована (старые 4/16/32/64 — ранний доступ; wiki.gg и
  dungeonpath ещё не обновились — их числа устарели).
- Ранее в базе стояло «в 1.0 кол-во НЕ уменьшили (116)» — НЕВЕРНО, исправлено в web-FAQ,
  docs/breeding_mechanics.md §6, CLAUDE.md. Эффект звёзд был записан верно (каждая +1 work
  suitability, 4★ = +1 ко всем).

## bosses.json Hartalis + STAB + универсальный рейд-атакер (2026-07-19)

- **Hartalis** (game8 /571689 + bisecthosting): Lv 65, ~909k HP, ДВЕ фазы — ф.1 Water/Grass
  (каунтер Electric), ф.2 лечится в фулл и становится Neutral (каунтер Dark); барьеры
  Grass←Fire / Water←Electric / Neutral←Dark, 15 сек или рейд-вайп. Было elements[] (thin).
- **STAB подтверждён** (thepalprofessor combat-mechanics + стим-обсуждения): скилл стихии
  самого пала +20% урона, перемножается с уязвимостью. Уязвимость ×2 / резист ×0.5
  (резист = защитник strong_vs стихии атаки).
- **Анализ «один пал на все рейды»** (матрица тайп-чарт × raid_bosses, скрипт-разово):
  Orserk (Dragon/Electric) — ×2 на Bellanoir/Libero + Xenolord + Hartalis ф.1, ни от кого
  не получает ×2, от Bellanoir ×0.5. Jetragon — премиум-альтернатива. Necromus как универсал
  проваливается (×0.5→/←×2 с Xenolord и Blazamut Ryu). Итог — docs/boss_fighting.md §5.

## pals_combat.json swim_speed (2026-07-19)

- **paldb.cc** (карточки палов, статы SwimSpeed/SwimDashSpeed) — скорость плавания и рывка
  вплавь для 9 плавательных маунтов. Сборщик: `scripts/collectors/fetch_swim_speed.py`.
  В воде ранжирует dash: Neptilius 2000 > Jormuntide 1800 > Surfent 1440 (по суше порядок иной).
  CLI `mounts swim` сортирует по swim_dash_speed; web показывает 🌊 в списке и карточке.

## combat_traits.json — EHP-математика рейд-билда + торты (2026-07-19)

- **Формула защиты** (game8 Defense Stat Explained): 100 DEF = 0% редукции, 200 DEF = половина
  урона, 300 = треть → урон ∝ 100/DEF → **EHP = HP × (1+ΣDEF%)**, +HP%-пассивок в игре нет.
  Пересчитан рейд-стек: Idiosyncratic+Immortality+**Diamond Body**+Legend = EHP ×1.75 / ATK +35%
  (Vampiric заменён: −30% DEF ради дублирующего лайфстила; макс-стена ×2.25 отвергнута — таймер).
- **Торты** (описания из карточек предметов paldb, 2026-07-19): Mushroom «talents grow slightly
  more easily» (talents = IV), Vegetable «lay eggs twice at once», Extravagant «mutations more
  likely + talents», Special «more likely inherit multiple passive skills». Шансы мутации
  Cake 1%/Vegetable 2%/Extravagant 3% — paldb /Mutation; Mushroom/Special % не указан.
  FAQ-вопрос «Торты: что какой делает» в web-бридинге; таблица в docs/breeding_mechanics.md §2.

## passives.json — мутационные пассивки: список и наследуемость (2026-07-18)

- **paldb.cc/en/Mutation** — мутационных (радужных) пассивок ровно **5**: Immortality,
  Idiosyncratic, Babysitter, Heavily Armored, **Skymarcher**. «Skirmisher» НЕ существует —
  удалён из passives.json (фантом ранних сводок). Шансы мутационного яйца: Cake 1% /
  Vegetable Cake 2% / Extravagant Vegetable Cake 3%.
- **Наследуемость** (paldb + twoaveragegamers/nexttier mutation breeding): первично — только
  из мутационного яйца, но затем **наследуются обычным бридингом** как пассивка родителя
  (Special Cake повышает шанс передачи); с Yakumo «Birds of a Feather» не работают.
  В passives.json: `mutation_exclusive:true, breedable:true` + `notes`. Обновлены web-FAQ
  бридинга, docs/breeding_mechanics.md §9, combat_traits.json.

## combat_traits.json — трейты бойца party/raid (2026-07-18)

- **Пати vs база-рейд:** allthings.how (мета-стек пассивок 1.0), xmodhub (combat vs base
  traits). Пати (управляешь) = офенс/стекло-пушка; базовый рейд (палы дерутся сами) =
  выживаемость (Idiosyncratic/Immortality/Vampiric/Diamond Body), БЕЗ −HP стеклопушек.
- **Простой = вживляемый:** bisecthosting / palworld.fandom Pal Surgery Table — Surgery Chip
  (Implant) вживляет обычные пассивки (~10–50k золота/чип). **World Tree (t5) грефтить нельзя**
  (playerauctions) — только ловля в биоме World Tree / Large Ominous Egg (после Panthalus).
- **Новые 1.0 пассивки:** gamerant (All New Passive Skills), 7 World Tree (God of Destruction,
  Twin-Edged Holy Blade, Sanctified Meat Shield, Demon's Hand и т.д.) — все уже в passives.json
  с эффектами. Эффекты/имена в combat_traits.json сверены с локальным passives.json.

## pals_combat.json transport_speed (2026-07-18)

- **paldb.cc/en/Transporting** — стат `Transport Speed` (скорость переноски груза, отдельный
  от Run Speed) для 147 транспортников. Сборщик: `scripts/collectors/fetch_transport_speed.py`.
  Важно: высокий run ≠ хороший транспортник (Mimog run 2000 / TS 450; Eye of Cthulhu TS 600).
  Механику подтвердили game8 (уровень = carry, не скорость; скорость переноски — отдельный стат)
  и paldb (обе колонки на странице Transporting).

## docs/boss_fighting.md + bosses.json world_bosses (2026-07-17)

- **Различие рейд/босс:** алтарные рейды (Summoning Altar) идут НА БАЗЕ — бьются
  назначенные базовые палы + турели; башенные/мировые боссы — пати из 5. **Panthalus**
  перенесён из `raid_bosses` в новую категорию `world_bosses` (призыв Echoing Flute, арена-море).
- **Рейд-база (1.0 wave-rework):** xgamingserver.com (Wave-Based Base Defense), palmods.gg
  (Base & Raids rework), 4netplayers.com (Raid Bosses Guide — каунтеры боссов, пороги уровней).
  Турели не жгут патроны; уровень рейдеров скейлится под палов базы; воронка + Homing Missile
  Turret. Точное число одновременных базовых палов источники не называют → PRELIMINARY.
- **Топ-бойцы боссов:** gamerant.com (Best Combat Pals 1.0: Bellanoir Libero/Frostallion/
  Necromus/Jetragon/Xenolord — S+), nexttier.pro (combat tier list). Идеальные скиллы —
  сверены с локальными `data/skill_dps_meta.json` (Necromus Twin Spears — топ по большому хитбоксу).
- **Боевые пассивки:** game8.co (Musclehead/Ferocious/Legend), allthings.how (Best Passives 1.0:
  God of Destruction, Twin-Edged Holy Blade, Immortality). Цифры эффектов взяты из локального
  `data/passives.json` (авторитетный). Все — PRELIMINARY 1.0.

Пометки: `(pre-1.0 guide)` — данные Early-Access-эпохи, не перепроверены под 1.0;
`(PRELIMINARY 1.0)` — данные 1.0, ещё стабилизируются.

## data/palworld_pals.csv — работы палов (собрано 2026-07-14)

- **paldb.cc** — списки палов и work suitability по каждому палу (парсер: `scripts/collectors/parse_pals.py`).
- Work-уровни 1–8 соответствуют шкале 1.0.

## data/pals_combat.json — боевые статы, маунты, partner skills (собрано 2026-07-14)

- **paldb.cc** — статы (HP/ATK/DEF), movement, partner skills, дропы; собрано батчами
  (`data/raw/_raw_batch*.json`, сборка: `scripts/collectors/_build_combat.py`).

## data/type_chart.json — таблица стихий (2026-07-14)

- Первичный черновик: `docs/boss_tower_counters.md` (компиляция game8.co, nexttier.pro,
  thepalprofessor.com, palworld.fandom.com).
- Верифицировано 2026-07-14 по двум независимым актуальным источникам (Dexerto — полная
  таблица; xgamingserver, статья от 2026-06-08): все 9 элементов совпали, правок не
  потребовалось (`verified: true`, URL в `sources` файла).

## data/bosses.json — башенные и рейдовые боссы (2026-07-14)

- Выжимка из `docs/boss_tower_counters.md` §2–§3, §7. Боссы 8–9 (Shaolong, Astralym)
  и часть рейдов — `(PRELIMINARY 1.0)` (флаг `preliminary: true` в записях).

## data/breeding.json — combi ranks и special combos (собрано 2026-07-14)

- **paldb.cc/en/Breeding_Farm** — полная таблица CombiRank (299/299 палов) и все 164
  unique-комбо (136 кросс-видовых + 28 self-pair «только одинаковой парой»). Версия 1.0
  подтверждена косвенно: список совпадает с палдексом 1.0 включая 1.0-only виды.
  Сырой дамп: `data/raw/paldb_breeding.html`; скрипты:
  `scripts/collectors/fetch_breeding.py`, `scripts/collectors/build_breeding_json.py`.
- **palworld.wiki.gg/wiki/Breeding** — формула `floor((A+B+1)/2)`, тайбрейк, требование пола.
- **palworld.ludbase.com** — подтверждение формулы и числа special-комбо под 1.0.
- Пробелы (см. `gaps` в файле): точный тайбрейк при равных рангах документирован
  противоречиво; 11 кроссовер-палов делят ранг 3100.

## data/tier_lists.json — тир-листы по ролям (собрано 2026-07-14)

- **palworld.gg** — тир-листы combat / flying mounts / ground mounts / base work
  (скрапинг: `scripts/collectors/fetch_tier_pages.sh`, `parse_palworld_gg.py`).
- **nexttier.pro**, **thebiglead.com** — скорости маунтов; **palworldzone.com** — пловцы;
  **oslink.io** — бойцы 1.0; **4netplayers.com**, mobalytics (сводка) — рыбалка 1.0.
- Все 89 записей сверены с CSV (0 несоответствий), work-уровни в заметках проверены
  программно. **pindrop.gg отброшен** (ещё pre-1.0 ростер); game8/fandom/wiki.gg были
  недоступны из-за бот-защиты — заменены источниками выше.
- Ни одна категория не взята из EA-эпохи (включая рыбалку — фича 1.0).

## data/expeditions.json + docs/expeditions.md — экспедиции (собрано 2026-07-14)

- **palpedia.net/expeditions** (сайт на v1.0.0) — все 18 миссий с полными пулами наград
  (279 строк с количеством и шансами); скрапинг: `scripts/collectors/parse_expeditions.py`,
  `build_expeditions_json.py`; сырой парс: `data/raw/expeditions_palpedia_raw.json`.
- **palworld.wiki.gg** (Expeditions, Pal_Expedition_Station) — механика, формула Firepower
  = (ATK + DEF + HP/5) × ранг-конденсации², стоимость станции.
- **xgamingserver** — патч-ноуты 1.0 (экспедиции расширены на Sunreach и World Tree).
- Пробелы: точная кривая скейлинга наград от избытка firepower; влияние трейтов (в `gaps`).

## data/active_skills.json — активные скиллы (собрано 2026-07-14)

- **paldb.cc/en/Active_Skills** — 328 скиллов, все с элементом/уроном/кулдауном
  (сырой HTML: `data/raw/paldb_active_skills.html`).
- **paldb.cc/en/<PalName>** — ленсеты 298/299 палов (у Astralym секция пуста — босс-пал).
  Скрипты: `scripts/collectors/fetch_skills.py`, `build_active_skills.py`.
- 157 эксклюзивов замаплены на палов; 46 внутренних boss-only записей исключены,
  10 дублей смержены (задокументировано в `notes` файла).

## data/resource_nodes.json + docs/resource_locations.md — ресурсы на карте (собрано 2026-07-14)

- 16 ресурсов (Ore, Coal, Quartz, Sulfur, Paldium, Crude Oil, Chromite, Hexolite,
  Paloxite, Radiant Gems, Soralite и др.), 47 локаций с координатами (x, y).
- Источники (18 в `sources` файла): nexttier.pro (базы 1.0, oil rigs), shockbyte (уголь),
  scalacube (руда/нефть), thegamer (skill fruits), vgtimes + bisecthosting (World Tree /
  Sunreach 1.0), nodecraft/holy.gg (сера, Chromite/Hexolite).
- Пробелы: у интерьера World Tree нет числовых координат (своя суб-карта); два конфликта
  координат помечены, а не разрешены (в `gaps`).

## data/items.json — база предметов (собрано 2026-07-14)

- **paldb.cc** (датасет v1.0.0 от 2026-07-10, дата релиза игры) — категории-индексы
  (Material, Ingredient, Consumable, Weapon, Armor, Accessory, Ammo, Sphere, Key_Items,
  Glider), 1269 карточек предметов (рецепты, дропы, торговцы, сундуки),
  paldb.cc/en/Technologies (tech-уровни). Скрипты: `scripts/collectors/fetch_items.py`,
  `parse_items.py`; сырые данные: `data/raw/item_slugs.json`, `item_meta.json`.
- 1195 предметов, 662 полных рецепта (цепочки компонентов полностью замкнуты),
  31 станция с tech-уровнями. `recipe.station` = станция минимального тира,
  альтернативы и размер партии — в notes предмета.
- 34 рецепта без станции на paldb (схематик/ивент-крафты, кроссовер-оружие) — оставлены
  null с пояснением в notes каждого; ~100 предметов без рецепта и источника (косметика
  из магазинов) перечислены в `gaps`.

## data/passives.json — пассивки (собрано 2026-07-14)

- **paldb.cc/en/Passive_Skills** — все 114 пассивок 1.0, тир-шкала −3..+5 (5 = новый
  золотой «World Tree»-тир); 109/114 с точными цифрами. Скрипты:
  `scripts/collectors/fetch_passives.py`, `fetch_passives_palworldgg.py`, `build_passives_json.py`.
- **palworld.gg/passive-skills** — кросс-чек (54 пересечения, 0 числовых конфликтов).
- Конфликты с docs/breeding_mechanics.md зафиксированы в `notes` файла: Emperor/Lord-пассивки
  в 1.0 дают +30% (в EA было +20%); Eternal Engine описан иначе. Пробелы: имена
  mutation-эксклюзивных пассивок не подтверждены (вероятно — 7 тир-5 «World Tree»-пассивок).

## data/pal_locations.json — где найти/поймать палов (собрано 2026-07-14)

- **paldb.cc** — 299 карточек палов + внутриигровые данные распределения спавнов
  (`DT_PaldexDistributionData.json`, ~19 МБ точек день/ночь, спроецированы на 68 именованных
  регионов 1.0 включая Sakurajima, Feybreak, Sky Islands, World Tree). Скрипты:
  `scripts/collectors/fetch_locations.py`, `fetch_paldex_distribution.py`,
  `build_locations_json.py`; промежуточные данные в `data/raw/`.
- Покрытие: дикие спавны 276/299 (в среднем ~4 региона на пала, по доле точек спавна);
  альфа-боссы с координатами 207/299; яйца 298/299; день/ночь 274/299 (12 ночных — список
  совпадает с известным поведением игры). 23 пала без дикого спавна — у каждого указан
  реальный способ получения (бридинг-комбо, рейд-яйцо, альфа).
- Websearch-факты: 11 Terraria-палов живут в данже Sealed Realm of Terraria; Astralym
  недоступен для получения (стори-босс).
- Пробелы: ассортимент торговцев/Black Marketeer не покрыт; имена регионов —
  аппроксимация «ближайшая метка».

## data/base_building.json — базостроение для конструктора баз (собрано 2026-07-14/15)

- **paldb.cc** (server-rendered, curl + regex-парсинг):
  - 58 страниц построек (категории Pal / Food / часть Production / Storage /
    Infrastructure) — tech level, флаг ancient tech (`Special_` в tech id), материалы
    (кросс-проверены против таблицы Materials/Product/Schematic — 0 расхождений),
    энергопотребление (`Energy X Per Sec`), Worker Max, описания.
  - **2026-07-15, дозаполнение до 125 структур**: изначальный сбор пропустил печи,
    верстаки, сборочные линии и всю категорию Lumbering/Mining. Полный список найден
    через индекс `/en/Structures` (487 зданий, декор/стены не собираем): +26 крафт-станций,
    +4 добывающих, +41 функциональное (шахты Coal/Sulfur/Quartz/Hexolite/Soralite,
    High-Pressure Oil Extractor, Guild Chest, пруды, алтарь, ресайклеры, сундуки).
    `worker_req` (Kindling+Cooling у Ancient Furnace и т.п.) — из описаний;
    min_level 6+ со слов игрока (PRELIMINARY). «Mine»/«Electric/Ice Mine» — ловушки.
    Две мои промежуточные ошибки зафиксированы и исправлены: «шахт нет» (промах по
    слагам) и заметка про Coal Mine в resource_nodes.
  - 56 страниц еды — Nutrition / SAN / Corruption (таймер порчи) / ворк-спид бафф;
    эффекты всех 5 тортов подтверждены текстами предметов 1.0.
  - 299 страниц палов — `FoodAmount` (аппетит, шкала 1–10, фактические значения 1–9) и
    `FullStomachDecreaseRate` (у всех = 1.0 в 1.0).
  - 12 страниц Work Suitability (`/en/Kindling` … `/en/Farming`) — точные таблицы
    work-speed по уровням 1–10, DropNumRate (Gathering ×1…×5.5), DamageRate
    (Lumbering/Mining), грузоподъёмность (Transporting), список исследований Research Lab.
- Веб-гайды 1.0 (nodecraft, palmods.gg, allthings.how, xgamingserver, neonlightsmedia):
  механика уровней пригодности 9–10 (Applied Handbook +1/книга per-pal, конденсация
  +1/звезда, партнёрские ауры +1 base-wide, пассивки), бридинг (5 мин/яйцо, 1 торт = 1 яйцо,
  Ancient Hatchery ~10 сек/цикл + 10 слотов, preliminary), инкубаторы (1/1/10/10 яиц),
  санити (Hot Spring rate 0.5), голод (пассивки ±10–20%, слайдер PalStomachDecreaceRate).
  Полный список URL — в `sources[]` внутри файла.
- Скрипты: `scripts/collectors/fetch_base_building.py` (сбор+парсинг, кэш страниц),
  `build_base_building.py` (сборка итогового JSON).
- Пробелы (в `gaps[]`): урожай грядок за цикл и абсолютные тайминги роста; базовая скорость
  голода/санити в ед./сек; точные множители скорости инкубаторов.
- Расхождение: paldb 1.0 даёт Pal Expedition Station tech 22 (Wooden Board 10, Stone 100,
  Paldium 20) против tech 15 в `expeditions.json` — требует перепроверки expeditions.json.

## Pal Labor Research Lab — каталог ресёрча (2026-07-16)

- **paldb.cc/en/Pal_Labor_Research_Laboratory** (v1.0.0) — все 168 проектов, 48 семейств;
  подтверждено wiki.gg + game8: эффекты постоянные и **account-wide** (на все базы).
- Максимумы: Work Speed +45% на работу (Cooling +40%; у Gathering/Transporting/Farming
  ресёрча нет), урожай плантаций +50%, рост +35%, инкубация +60%, нефть +90%, склад энергии
  +70%, расход −20%, порча −30%, экспедиции +35%/−35%. Полный список — в
  `data/base_building.json` → `rates.research_lab`. Скрипт: `scripts/collectors/scrape_research_lab.py`.
- Планировщик: тумблер «макс ресёрч» / `--research` → WS ×1.45 и урожай ×1.5 (меньше рабочих/грядок).
  Оговорка: у Gathering/Transport/Farming буста нет — для ранча реальный эффект меньше (в заметке).

## Точечные правки по игровому опыту

- **2026-07-14, Coralum Ore через сальвадж-магниты** — сообщено пользователем из игры,
  подтверждено по paldb.cc/en/Powerful_Fishing_Magnet (лут-таблица сальваджа: Coralum Ore
  x1–2, 30%). Внесено в `items.json` (Coralum Ore, оба магнита) и `resource_nodes.json`.

## data/regions.json — координаты регионов карты (2026-07-15)

- Производное от `data/raw/paldb_region_labels.json` (метки регионов paldb с ipos):
  80 регионов → (x, y) центра метки. Покрывает 66/77 регионов из pal_locations
  (+ уровневые подзоны через отрезание суффикса `[Lv. X-Y]`). Входы в данжи
  для данжевых альфа-боссов не документированы — пробел.

## data/icons.json — карта "items" (иконки предметов, 2026-07-15)

- https://paldb.cc/en/Items (страница-список всех предметов): пары slug → cdn-URL иконки
  извлечены одним запросом (`scripts/collectors/fetch_item_icons.py`,
  кэш — `data/raw/item_icon_urls.json`). Покрытие 1195/1195 имён из items.json.
  4 предмета (Mythical Wooden Board, Potage, Sunreach Rapid-Fire/Single-Shot Ammo)
  на самом paldb имеют плейсхолдер `T_icon_unknown.webp` — оставлен как есть.
  NB: часть файлов cdn.paldb.cc отдаёт 403 без заголовка `Referer: https://paldb.cc/`.

## data/merchants.json — торговцы и магазины (2026-07-15)

- **paldb.cc/en/Merchant** — все 587 листингов «Wandering Merchant» (предмет → код
  магазина), 38 магазинов. **paldb.cc/en/<Shop_Code>** (38 страниц) — ассортимент,
  цены и валюта каждого магазина (пустая колонка цены = продажа за Gold Coin по
  стандартной цене предмета). **paldb.cc/en/Caravan_Merchant** + 23 страницы NPC —
  имена караванных торговцев 1.0 → коды Caravan_Shop_1–25 (посещают базу игрока).
  **paldb.cc/js/map_data_en.js** — точные координаты маркеров торговцев на карте:
  Wandering Merchant (4 поселения, href=Village_Shop_1), Duneshelter (Desert_Shop_1/2),
  Fisherman's Point (Volcano_Shop_1/2), Arena Merchant (631,16) = Arena_Shop_1
  (Battle Ticket), Medal Merchant (4 церкви) = Medal_Shop_1 (Dog Coin), PIDF Bounty
  Officer (3 поселения) = Bounty_Shop_1 (Successful Bounty Token); там же Pal
  Merchant / Black Marketeer (продают палов → `pal_traders`).
  Скрипт: `scripts/collectors/fetch_merchants.py` (резюмируемый, кэш страниц).
- В `items.json` 228 плейсхолдеров «Sold by merchants (N shop listings)» заменены на
  конкретные строки «Sold by <торговец> (<цена/валюта>) - <локация (координаты)>».
- Пробелы: Vagrant_Trader_1_1/2/3 — личность/локация не документированы (в т.ч.
  websearch 2026-07-15 ничего не дал); Wander_Shop_1 (случайный бродячий торговец) и
  Dungeon_Shop_01 (в данжах) фиксированных координат не имеют by design.

## Скорость голода / кормовая модель — веб-исследование (2026-07-16)

- **Абсолютный темп голода НЕ задокументирован** нигде (palworld.wiki.gg/Food+Hunger, paldb,
  датамайн Pal-Editor). Часто цитируемое «~1 еда/6с» — иллюстрация автора Steam-поста, не измерение.
- Подтверждено: `FullStomachDecreaseRate`=1.0 у всех (paldb), мировой `PalStomachDecreaceRate`=1.0
  (DefaultPalWorldSettings.ini), палы едят до ~50% сытости, варёное раз в 10-15 мин.
- Пассивки голода: Diet Lover −15%, Dainty Eater −10%, Mastery of Fasting −20%,
  Glutton +10%, Bottomless Stomach +15% (palworld.fandom).
- Кормовая модель планировщика откалибрована по гайду **dungeonpath** (2 Berry + 1 Wheat + Mill
  → 15-20 палов варёными булками): `--food-per-plot ≈ 55` аппетит-единиц/грядку. Детали и все
  URL — в `data/base_building.json` → `rates.hunger_research`.

## docs/ — гайды (компиляции, собраны 2026-07-14)

- `breeding_mechanics.md` — game8.co (cake, инхерит пассивок, condenser, IV, пассивки),
  xgamingserver.com и hostedgg.com (Mutation/Awakening 1.0), palworld.fandom.com.
  Полный список URL — внизу самого файла.
- `boss_tower_counters.md` — game8.co, nexttier.pro, thepalprofessor.com,
  palworld.fandom.com, allthings.how.
- `base_setup.md` — palworld.wiki.gg (крафт-косты, Feybreak-эпоха → `(pre-1.0 guide)`).
- `guild_stash_and_storage.md` — компиляция wiki/гайдов Feybreak-эпохи, помечено где не перепроверено.

## Правила добавления записей

При каждом обновлении данных добавлять сюда (или в `sources[]` внутри JSON): URL источника,
что именно взято, дату получения. Не выдумывать значения: нет данных → null + запись в `gaps`.

## 2026-07-16 — Growth Acceleration Bell (эффект)
- Источник: https://paldb.cc/en/Growth_Acceleration_Bell
- Взято: описание эффекта аксессуара «An accessory that raises Pal EXP. Pal EXP Up Lv. 3»
  → дописано в notes предмета в items.json. Точный процент на странице не указан (gap).
- Партнёрка Omascul (#150) «Party Pals' EXP gained +40~80%» уже была в pals_combat.json —
  размечена тегом party:exp_boost в build_index.py (цель `party xp`).

## 2026-07-16 — Эффекты аксессуаров (все 84) + оружейная/пати-мета 1.0
- Источник: paldb.cc (og:description каждой страницы аксессуара), сборщик
  `scripts/collectors/fetch_accessory_effects.py` → поле `effect` в items.json (84/84).
  Проценты за "Lv. 3/4" пассивок на страницах не публикуются (gap).
- Веб-ресёрч (агенты, 2026-07-16): оружейная мета боссов 1.0 (Drone Launcher + Mechanical Bow,
  схемы с рейд-башен/Moon Lord/oil rig, Drafting Table) и мета состава пати (стакание аур
  убрано в 1.0, исключения ~25 палов incl. Gobfin; архетипы 1+4 / игрок-кэрри / 3-5 бойцов;
  Wing Pack вместо глайдер-пала; Lapure -КД партнёрок; Gildra самовоскрешение) —
  источники и даты в docs/boss_tower_counters.md. Всё PRELIMINARY (6 дней после релиза).
- build_index.py: новые party-теги elem_team_atk/def:{стихия} (ауры на все 9 стихий),
  bullet_stack (Orserk), cd_support (Lapure), revive (Gildra). Боевой скелет пати обновлён.

## 2026-07-16 — Источники добычи аксессуаров (схемы с шансами и координатами)
- Источник: paldb.cc — страницы схем "<Name> Schematic" (Treasure Box таблицы).
  Сборщик расширен: scripts/collectors/fetch_accessory_effects.py теперь пишет
  schematic_sources[] (сундук/данж + шанс; фикс-точки Ancient Ruin с координатами)
  и drop_sources[] (прямых дропов не нашлось — 0).
- Итог: 70/84 аксессуаров крафтятся ПО СХЕМАМ (у предметов tech_level=null):
  Rare-схемы — Lv55 Oilrig Greater Chest (~1.2%) / Feybreak Treasure (~3.4%) /
  Feybreak Dungeon (~0.2%) / фикс. Ancient Ruin; Epic (талисманы/батоны/эмблемы,
  кольца палов) — SkyIsland Treasure (~2.4%) / SkyIsland02 (~0.2%) / Lv60 Oilrig
  Greater Chest (~1%) / фикс. Ancient Ruin. 11 старых — тех-дерево (tech_level).
  Night Vision Goggles и Quadruple-боты: источник на paldb не указан (gap).

## 2026-07-16 — Panthalus как мировой босс (исправление атрибуции арены)
- Морская арена с цунами относится к бою с Panthalus (#203), НЕ к Zanara & Astralym
  (моя ошибка атрибуции player-report'а — исправлено).
- bosses.json: raid_bosses += Panthalus (Water, каунтер Electric, Lv. 70 Ocean King,
  arena: открытое море — swim обязателен, flyer от цунами; player-reported 2026-07-16).
  У Zanara & Astralym поле arena удалено.
- pal_locations.json: локация альфы Panthalus уточнена (был gap «location not listed»).

## 2026-07-16 — Panthalus: призыв Echoing Flute (уточнение player-report)
- Panthalus призывается предметом Echoing Flute (key_item, крафт: Marine/Silent/
  Seafoam/Tidewind Echobone x1 на Primitive Workbench) по основному квесту;
  призыв переносит на водную арену. bosses.json + pal_locations.json обновлены.

## 2026-07-16 — Panthalus НЕ атакер: best_fighters переписан по консенсусу редакций
- Веб-ресёрч (агент): Panthalus (#203) отсутствует во ВСЕХ редакторских списках лучших
  бойцов 1.0 (oslink, nexttier, gamerant, neonlightsmedia, game8) — его роль в гайдах:
  летающий маунт + уникальная ПВО базы (партнёрка, 1 на базу). S-tier дают только
  формульные сайты (palworld.gg сетка без обоснований; palmods-индекс 65% offense +
  35% bulk), где его аномальный bulk (HP 180/DEF 200) раздувает скор при ATK 120.
  Формула урона игры (palworldcompanion.com): урон множит ТОЛЬКО Attack.
- tier_lists.json best_fighters: переупорядочен по частоте в редакторских списках
  (Jetragon, Necromus, Xenolord, Frostallion/Noct, Shadowbeak, Bellanoir Libero,
  Blazamut Ryu, Jormuntide Ignis, Neptilius, ...); Panthalus исключён.
- Подбор бойцов в пати (веб+CLI): сначала ранг тир-листа, затем Attack
  (вместо старой формулы 2*ATK+HP+DEF, которая переоценивала танков).

## 2026-07-16 — Скиллы пати ранжируются по ДПМ (не по голому урону)
- По просьбе: подбор скиллов бойца = ДПМ (power × 60 / cooldown_seconds), ×2 если
  враг слаб к стихии скилла; берём тяжёлые (power≥300 — на боссе мало теряется на
  защите), добираем слабыми только у низкоуровневых палов. Показывается и для
  бестиповых боссов (raw-пати), где раньше скиллы не рендерились вовсе.
- Веб-ресёрч меты скиллов (агент) НЕ выполнен — упёрся в месячный лимит расходов
  организации. Это не критично: ДПМ из локальных active_skills.json — ровно тот
  эвристический критерий, что просил пользователь («не голый урон, а урон/минуту»).
- ГЭП: в active_skills.json нет времени каста/анимации (только cooldown_seconds).
  «charge» в описаниях в основном = «рывок вперёд», а не долгий каст → не пенализируем.
  ДПМ учитывает только кулдаун; в заметках пати это явно оговорено.

## 2026-07-16 — Мета активных скиллов (замеренный DPS) + новый data/skill_dps_meta.json
- Источники (WebSearch/WebFetch напрямую; Reddit заблокирован для нашего агента):
  allthings.how «Best Attacks by DPS» (2026-07-16) — замеренный DPS по большому/мелкому
  хитбоксу + мульти-хит механика; thepalprofessor «Best Active Skills» (v1.0) — DPS=power/cd
  с baseline CD 5, таблицы по хитбоксам, boss-рекомендации; game8 tier list (JS, не спарсился).
- КЛЮЧЕВОЙ вывод, менявший подход: реальный DPS по боссу зависит от МУЛЬТИ-ХИТА и размера
  хитбокса (Twin Spears 128 DPS по большому / 23 по мелкому). Голая power/cd формула этого
  не отражает → создан data/skill_dps_meta.json (14 замеренных скиллов: dps_large/small,
  multi_hit, acquire, элемент, заметка, guidance, sources, preliminary=true).
- query.py/веб: производный ДПМ ленсета теперь power×60/max(cd,5) (baseline-5 душит спам-скиллы,
  метод thepalprofessor; убран самопальный порог power≥300). Пати combat + каунтеры + босс
  показывают блок «🎯 Мета-скиллы под босса»: каунтер-стихия (×2) + универсальные all-rounder'ы,
  с указанием как добыть (fruit/breeding/exclusive). Честная оговорка: ⚡-чипы у карточек —
  оценка по одиночной цели; время каста в данных отсутствует. ГЭП: нет Ground-скилла с
  замеренным DPS (гайды дали названия без цифр) — под Ground показываются all-rounder'ы.

## 2026-07-16 — Мульти-хит: множитель хитбокса + оговорка об обманчивости описаний
- Уточнение по мульти-хиту (WebSearch подтвердил канонический набор — те же 4: Twin Spears,
  Thunder Rail, Circle Vine, Apocalypse, новых гайды не называют). Добавлено:
  множитель хитбокса = dps_large/dps_small (Twin Spears ×5.6, Thunder Rail ×3.0, Circle Vine
  ×2.9, Apocalypse ×2.5) — показывается в мета-блоке (веб+CLI).
- Зафиксировано в guidance skill_dps_meta.json: определить мульти-хит по ОПИСАНИЮ нельзя
  (Comet Barrage/Beam Comet звучат как мульти-хит, но по замерам ровные — снаряды бьют по
  разным точкам). Флаг multi_hit ставится только по замеренному dps_large≫dps_small.

## 2026-07-16 — QA пати-пресетов: фиксы Neutral-бойца и метки слота атаки
- Прогон всех 22 пресетов (combat×9 стихий + varvs/raw/sea/two-fighters, fishing, catch,
  loot, eggs, openworld, explore cold/heat, xp): 5 слотов везде (xp — 3), без дублей палов.
- Баг: у Neutral-бойца пустой strong_vs → в выводе печаталось «резист от None» и
  «Пати против None-врагов». Фикс (веб+CLI): при пустом враге слот резиста → «живучесть
  (без стихийного бонуса)», заметка «универсальный боец; каунтерится <weak_to>».
- Баг: слот «атаки становятся <стихия>» доставался Solenne (player_atk) у стихий без
  attack_type-пала (Neutral) — неверная метка. Фикс: сначала pick attack_type с этой меткой,
  иначе отдельный pick player_atk с меткой «+Attack».
- Не баг: 11 палов с пустым Number — это Terraria-коллаб (слаймы, Demon Eye, Eye of Cthulhu,
  Cave Bat, Enchanted Sword, Illuminant*) — у коллаб-палов нет палдекс-номера, показываем без «#».

## 2026-07-16 — При равном эффекте ауры обычный пал раньше коллаб-пала
- build_index.py: сортировка party:*/egg_* тегов получила тай-брейк — при равной силе
  эффекта пал БЕЗ палдекс-номера (Terraria-коллаб) уходит ниже номерного. Затронуты:
  party:elem_team_atk:Dark (Hoocrates #19 вместо Demon Eye), party:loot:Dark (Elphidran
  #63 вместо Enchanted Sword). Коллаб-пал теперь в «заменах», не в основном пике.

## 2026-07-16 — Пати учитывает настройки мира: «без веса»
- Настройки мира влияют на ценность слотов. Реализован тумблер «без веса» (веб-чекбокс
  pweightless + CLI --weightless): при отключённом весе ауры грузоподъёмности (weight/
  weight_cargo) бесполезны → убираются из loot/fishing/eggs, слоты добиваются полезными
  аурами (сустейн/атака/Orserk) без дубля ролей; весовые аксессуары (Islander's Tool Belt,
  Wandering Merchant Charm) тоже исключаются, для loot подставляется Dogen Emblem (+атака).
- catch/openworld не тронуты: там Lunaris ценен самонаведением сфер, не весом.
- Прочие настройки мира — ценность аур меняют мягко (drop-rate → лут-ауры менее важны;
  EXP-rate → Omascul; capture-rate → капча-ауры), пока не автоматизированы (не бинарны,
  аура всё равно полезна). Кандидат на будущее, если понадобится.

## 2026-07-17 — Топ-места под базы (early/mid/late/endgame) → docs/base_locations.md
- Веб-ресёрч (агент): места под базы по стадиям с координатами + критерии выбора
  (ресурсы→рельеф→безопасность, смещение приоритета по прогрессу), лимит баз 4
  (до 10 через World Settings), специализация. Новое в 1.0: Sunreach (Soralite),
  World Tree (Paloxite, строить нельзя); Sakurajima/Feybreak — пред-1.0 DLC.
  Всё PRELIMINARY; конфликты координат/чисел нод отмечены в §5 гайда.
- Источники: nexttier.pro, drawpie.com, powerupgaming.co.uk, allthings.how,
  game8.co, pindrop.gg (июль 2026); thegameslayer.com (2025-01, пред-1.0).

## 2026-07-17 — Детали наследования при бридинге (альфа/звёзды/рарность/мутационные пассивки)
- WebSearch/WebFetch (palworld.wiki.gg, allthings.how, thepalprofessor, switchbladegaming,
  boostmatch, game8): альфа-статус/звёзды Condenser/уровень/рарность/work-апгрейды/Awakening
  НЕ наследуются (навешиваются на потомка заново); статы = база вида × IV, сырые статы
  родителей не усредняются; активки ставятся Skill Fruit'ами; мутационно-эксклюзивные
  пассивки (Babysitter, Idiosyncratic, Immortality, Heavily Armored, Skirmisher) из пула
  родителей не выводятся. Всё PRELIMINARY (альфа-% ~5% — комьюнити).
- data/passives.json: эти 5 помечены breedable=false + mutation_exclusive=true (добавлен
  Skirmisher). docs/breeding_mechanics.md §9 «Наследование: что переходит, а что НЕТ».
  Веб-FAQ бридинга дополнен 3 разделами (статы-формула, что НЕ переходит, какие пассивки
  не вывести) + активки/фрукт/мануал.

## 2026-07-17 — Конденсация (кол-во) + порядок бридинга и лайфхаки
- WebSearch/WebFetch (palworld.fandom Condenser, allthings.how мутации 1.0, nexttier.pro,
  xgamingserver, boostmatch, switchbladegaming): конденсацию в 1.0 НЕ уменьшили — те же
  4/16/32/64=116; переделали ЧТО даёт звезда (+1 work suitability, 4★=+1 ко всем). Мутант-
  яйцо вылупляется 2★ + IV 91–100 + 2–4 радужные пассивки (исключение к «потомок 0★»).
  Порядок: вид→мутация(опц.)→пассивки→IV→активки(Skill Fruit)→звёзды→Awakening; гайды
  расходятся по времени мутации. Лайфхаки: объём/несколько ферм, Babysitter-цикл, альфы=
  высокие IV, правило «ровно 4», торты в сундук, Yakumo. Веб-FAQ +2 раздела, docs §6/§7/§10.

## 2026-07-17 — Калибровка Ancient Farm ×3 + пояснение по тортам
- Игрок: 4 древние фермы (Tomato+Lettuce) кормят базу 50 майнинг-палов с избытком →
  Ancient Farm кратно продуктивнее обычной грядки. --ancient-farm-yield / поле «Ancient Farm ×»:
  дефолт 1 → 3. Брид-база на макс-тире: древних ферм ~12 → ~6 (еда + тортовая линия ужались).
  Низкий тир (обычные плантации) не затронут. Точной выработки Ancient Farm в данных нет (gap).
- Торты — НЕ линейные тиры: у каждого свой эффект/станция/ингредиенты (Vegetable=2 яйца
  Tomato+Lettuce; Special=пассивки Milk+Egg+Mammorest; Extravagant=мутация; Mushroom=статы) —
  добавлено пояснение в брид-пресет (веб+CLI), рецепты сверены с items.json.

## 2026-07-17 — Планер: фикс Hot Spring, еда ×2, ранч учитывает Ranch Master/handbook
- Игрок: даже 6 грядок (3 Tomato/3 Lettuce) — сильный перебор еды → --food-per-plot 55→110
  (кормит вдвое больше палов/грядку; точной скорости голода в данных нет, калибровка по игроку).
- Баг: Hot Spring считался 1 на 6 палов → 9 шт на 50. Исправлено на ~1 на 25 (SAN падает
  медленно, палы ротируются) → 2 шт на 50.
- Ранч: подтверждено — стоимость уже × q() (звёзды --stars, пассивки --workforce, ресёрч).
  Добавлен трейт **Ranch Master (+2 Farming, tier 4)** / Farmhand (+1) / Applied Technique
  Handbook: при палах с пассивками ранч-множитель ×1.5 (ranch_mult/ranchMult) → меньше ранч-палов.
  Трейт есть в data/passives.json (Ranch Master, Farmhand).

## 2026-07-17 — Планер учитывает yield-саппортов в выработке грядок
- Раньше пресеты НАНИМАЛИ Lullu (crop growth +50~70%) и Prunelia (harvest +18~35%), но их
  бонус НЕ входил в plant_yield_eff → число грядок завышалось. Теперь plant_yield_eff/
  plantYieldEff × (1.6 рост × 1.26 урожай ≈ ×2). Брид-база макс-тир: древних ферм ~6 → ~4-5.
  Оба саппорта — базовые ауры «Does not stack», уже в support_core пресетов. Средние
  значения диапазонов; помечено в допущениях (веб+CLI).

## 2026-07-17 — Саппорт-ауры зависят от звёзд конденсации
- Игрок: сила базовых аур (crop growth, harvest, egg speed) = ПАРТНЁРСКИЕ скиллы, растут от
  звёзд конденсации; диапазоны «+X~Y%» = 0★…4★. Планер: при тумблере 4★ (--stars) берём верх
  диапазона, иначе низ. plant_yield_eff: Lullu рост ×1.5(0★)/×1.7(4★) × Prunelia урожай
  ×1.18/×1.35. Braloha egg boost ×1.2(0★)/×1.5(4★). Веб+CLI, отражено в допущениях.
- Замечено (вне этой правки): веб-солвер бридинга пакует больше ферм под слоты, чем CLI
  (tech40: веб 3 фермы/43 пала, CLI 1) — расхождение fit-to-slots логики, не переполняет лимит;
  кандидат на сверку солверов.

## 2026-07-17 — +1-суитабилити-саппорты по ВСЕМ 12 работам добавлены в пресеты
- Проверено: у каждой из 12 работ есть пал-саппорт «+1 к этому навыку всем палам базы»
  (Does not stack): Kindling→Katress Ignis, Watering→Amione, Planting→Petallia,
  Generating Electricity→Puffolt, Handiwork→Ribbuny, Gathering→Clovee, Lumbering→Eikthyrdeer
  Terra, Mining→Tetroise, Medicine→Mycora, Cooling→Smokie Cryst, Transporting→Wumpo,
  Farming→Cinnamoth (уже в index base_support:suitability:*).
- Добавлены в пресеты под реальные рабочие группы: breeding +Clovee (тройка Gathering)
  +Cinnamoth (ранч Farming) [Amione/Petallia уже были]; mine-craft +Katress Ignis (печи
  Kindling) [Tetroise/Ribbuny/Wumpo уже были]. Эффект +1 кредитуется в счёте рабочих:
  тройка — garden_mult ×1.35, ранч — ranch_mult; 4★ (+1 ко всем навыкам) — через q() ×1.55.
  Веб+CLI. Верифицировано: солверы бридинга веб==CLI (38/61/84 голов), расхождение было
  из-за разного workforce, не бага.

## 2026-07-17 — Ancient Farm ×4 (второй замер игрока) + проверка бонусов в счёте зданий
- Игрок: 1 Ancient Hatchery + 4 Ancient Farms под Extravagant Vegetable Cake = более чем
  достаточно. Модель давала 5 (Wheat 2). Оба замера игрока (еда 50 палов; Extravagant на
  хатчери) сходятся на выработке ×4 → --ancient-farm-yield / «Ancient Farm ×» 3→4.
  Теперь 1 хатчери Extravagant = 4 фермы (Carrot/Onion/Potato/Wheat по 1), совпадает.
- Проверено: yield-бонусы ДОХОДЯТ до счёта ЗДАНИЙ (ферм) через plant_yield_eff = базовая ×
  Lullu(рост) × Prunelia(урожай, обе от звёзд) × ресёрч ÷ AFY. Суитабилити-саппорты
  (Planting/Watering/Gathering +1) влияют на число РАБОЧИХ (тройка/ранч), не на число ферм.

## 2026-07-17 — Поправка калибровки: еда=плантации(80), Ancient Farm=×1 (неизвестно)
- Уточнение игрока: «4 ПЛАНТАЦИИ (не древние фермы) кормят 50 палов на mining-craft базе».
  → --food-per-plot 110→80 (спрос 50-пал базы ~298 аппетита → 4 грядки). Раньше задрал до 110
  (давало ~2 — недокорм). Теперь mine-craft 50 = 4 плантации, совпадает.
- «Быстрее ли Ancient Farm плантации — сложно сказать» → --ancient-farm-yield 4→1 (=плантация,
  честно; было переоценено). Число ферм/грядок режут yield-саппорты Lullu (рост)/Prunelia
  (урожай), которые star-scaled (диапазоны +50~70% / +18~35% = 0★…4★) — подтверждено, они в
  plant_yield_eff. AFY остаётся крутилкой: если по игре Ancient Farm быстрее, поднять.

## 2026-07-17 — Ancient Hatchery: инкубация ~10с, дефолт 1 ферма (не «забить слоты»)
- Игрок: у Ancient Hatchery ~10 сек/яйцо (инкубация почти мгновенная). Вывод: >1 хатчери
  обычно не нужен — узкое место не производство, а разбор получающегося потомства; 2 —
  для параллельного бридинга РАЗНЫХ пар. Солвер бридинга: авто-заполнение слотов заменено
  на дефолт 1 ферма (--farms/«брид-ферм» задаёт вручную); в заметке справочно «сколько влезло бы».
- Хатчери: инкубация мгновенная → Dynamoff (сокращение инкубации) и отдельные инкубаторы не
  нанимаются/не строятся; кладка остаётся ограничена тортом (5 мин/яйцо под смету линии).
  Веб+CLI.
