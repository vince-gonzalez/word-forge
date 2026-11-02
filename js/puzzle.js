// ═══════════════════════════════════════════════
//  WordForge — Puzzle Engine & Trie Dictionary
// ═══════════════════════════════════════════════

'use strict';

// The word list lives in js/words.js, loaded before this file.

// ── Trie Implementation ──
class TrieNode {
  constructor() {
    this.children = {};
    this.isWord = false;
    this.word = null;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word) {
    let node = this.root;
    for (const ch of word.toLowerCase()) {
      if (!node.children[ch]) node.children[ch] = new TrieNode();
      node = node.children[ch];
    }
    node.isWord = true;
  }

  hasPrefix(prefix) {
    let node = this.root;
    for (const ch of prefix.toLowerCase()) {
      if (!node.children[ch]) return false;
      node = node.children[ch];
    }
    return true;
  }

  isWord(word) {
    let node = this.root;
    for (const ch of word.toLowerCase()) {
      if (!node.children[ch]) return false;
      node = node.children[ch];
    }
    return node.isWord;
  }

  getNode(prefix) {
    let node = this.root;
    for (const ch of prefix.toLowerCase()) {
      if (!node.children[ch]) return null;
      node = node.children[ch];
    }
    return node;
  }
}

// ── Words that never score: slurs whose main meaning is hate ──
// Words with a real other meaning stay playable (queer, chink, coon, retard, dyke, spade...).
const BLOCKED = new Set(`
kike kikes spic spics spick spicks wop wops gook gooks nigger niggers wetback wetbacks
chinky dago dagos dagoes darkie darkies darky kraut krauts honky honkies squaw squaws
redskin redskins coolie coolies hebe hebes yid yids mick micks bohunk bohunks shiksa shegetz
fag fags faggy faggot faggots jew jews jewed jewing gyp gyps gypped gypping
`.trim().split(/\s+/));

// ── Build global trie ──
const TRIE = new Trie();
const WORD_SET = new Set();
for (const w of WORD_LIST_RAW) {
  const clean = w.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length >= 3 && !BLOCKED.has(clean)) {
    TRIE.insert(clean);
    WORD_SET.add(clean);
  }
}

// ── Everyday words: the only ones that can be targets ──
// Words most adults know and use; a subset of the full list in words.js.
const EVERYDAY_RAW = `
about above abuse ache acid act add adult after again aid air all allow alone along also alter amass amaze
amber among and angel anger animal annoy any apart apply apron arc area argue arise arm army art ash aside
ask ate atop audit aunt aura auto awake award aware away awful axe axed axes bad bade badly bag baggy
bags bail bait baits bake baked baker bakes bald ball balls balm balms ban band bands bang bangs bank banks
bar bars base bases bash basic bask basks bass bat batch bath baths bats beach bead beads beam beams bean
beans bear beard bears beat beats beef beefs been beer beers bees beet beets beg beige being belly belt belts
bench bend bends bent berry bird birds birth bite bites bits black blade blank blast blaze blend bless blind bliss
block blog blond blood blow blows blue blues blunt blur blurs blush boar board boast boat boats bob bobs body
bog bold bolt bomb bombs bond bonds bone boned bones bonus boo boob book books boom booms boon boor boost
boot booth boots booty booze boozy bore bored bores born borne both bough bound bout bouts bow bowed bowl bowls
box boxed boxer boxes boy boys bra brace brag brags braid brain brake bread break brew briar bribe brick bride
brief brig brim brink brisk brit broad broil broke brook broom broth brow brown brush brute bub buck bud buddy
budge buds buff buffs bug buggy build built bulb bulbs bulge bulk bull bulls bully bum bump bumps bumpy bun
bunch buns bunt buoy bur burg burn burns burp burps burr bury bus bush bust busy but butt butts buy
buys buzz bye cell chair chalk champ chant chap chaps char charm chart chase chat chats cheap cheat check cheek
cheer chef chest chew chick child chili chill chime chin chip chips choir chop chops chore chug chugs chum chums
chunk churn chute cider cigar cinch cite city civic civil clan clans clap claps clash class claw claws clay clean
clear clerk click cliff climb cling clip clips clock cloud clove clown club clubs clue clues coach coal coast coat
coax cob cod code coin cold coma comb come comet comic con cook cool coop cop cope copy cord core
cork corn cost cot couch cough could count court cover cow crab crack craft cram crash crate crawl crew crib
cried cries crime croak crop crops cross crow crowd crown crud cruel crumb crush cry cub cube cubes cubs cue
cuff cuffs cup cur curb curds cure cured cures curl curls curly curry curse cut cute cuts cycle dab dabs
dad daily dairy daisy dam dame dames damp damps dance dare dark dart dash data date dates day days dead
deal deals dear death deep doubt dough douse dove doves draft drag drags drain dream dress drew dried dries drift
drink drip drips drive drone drool droop drop drops drug drugs drum drums drunk dry dryly duck dues duet duffs
dug dull dully dumb dummy dump dumps dune dunes dust dusts dusty duty duvet dwarf dwell dwelt dye dyes dying
each eager ear ears earth ease eased eases east easy eat eats eave eaves ebb ebbs eels egg eggs eight
eject eke elbow elder elect elk elm elms else face faced faces fact facts fade fades fail fails fair fairs
fairy fake faked fakes fall falls false fame famed fans far farm farms fart farts fast fasts fat fatal fate
fated fates fault fawn fawns fear fears feast feat feats feed feeds feel feels feet feign fell fells felt fence
fend fends ferry few fig fight figs file filed files fill fills film films fine fined finer fines fish fishy
fist fists fit fits five fix fixes flag flags flair flake flaky flank flap flaps flare flash flat flats flaw
flaws flea fleas flee flees fleet flesh flew flex flick flies fling flip flips flirt flit flits float flood floor
flop flops floss flour flow flows flu flue fluff fluid flume flush flute fly foam foams foamy fob fold folds
folk folks fond food fool foot fork form fort four fowl fox fry fun fund fur fuse fuss fuzzy gain
game gate gay gear gift girl give glad glass glee globe glove glow glows glued glum glut gnat gnats gnaw
gnaws goads goal goals goat goats gob gobs god gods heaps hear heard hears heart heat heavy heck hedge heed
heels heft hefty hem hens her herb herbs herd herds here hers high hike hiked hikes hill hills hilly him
hind hinds hinge hint hints hip hire hired hires his hiss hit hitch hits hive hived hives hoars hoax hob
hobby hocks hog hogs hope hoped hopes hops horde horn horns horse hose host hosts hot hound hour hours house
hove how howl howls hub hubs hue huff hug huge hula hulas hull hulls hum human humid hump hums hunt
hunts hurl hurls hurry hurt hurts hush husk husky hut hymns hype hyped hyper hypes inlay inlet inner input inset
inter into item items its ivy jab jabs jack jacks jade jaded jag jail jails jam jamb jams jar jars
jaw jawed jaws jay jays jazz jazzy jean jeans jeep jeeps jeer jeers jelly jerk jerks jerky jess jest jests
jet jetty jewel jib jibe jibed jibes jibs jigs jill jimmy jinx jive jived jives job jobs jock jocks jog
jogs join joins joint joke joked jokes jolly jolt jolts josh joss jot jots joy joyed joys judge jug jugs
juice juicy jukes jump jumps jumpy junk junks junky jute juts kale keep keeps keg kegs kelp kelps kemp ken
kiosk kiss kit kite kites kitty knack knead knee knees knelt knew knife knit knits knob knobs knock knoll knot
knots know knows kop kops labor lace laced laces lack lacks lad laden ladle lads lady lag lager lags laid
lain lair laird lake lakes lamb lambs lame lamp lamps lance land lands lane lanes lank lap lapel laps large
lark larks lass last lasts lat latch late later latex lath latin laugh lav lava lavas law lawn lawns laws
lax lay layer lays laze lea leach lead leads leaf leafy leak leaks leaky lean leans leant leap leaps leapt
learn leas lease leash least leave led ledge lee leech leek leers leery left lefty leg legal legit legs lei
leis lemon lemur lend lends lens lent leper let lets level lever levy lewd lex liar licks lid lie lied
lift lifts light like liked likes lily lima limb limbs lime limes limit limp limps line lined lines link links
lip lips list lists lit live lives load loads loaf loan loans lob lobs lock locks log logs loin loins
loll lolls lone long longs looks loop loops loose loot loots lop lord lords lose loses loss lost lot lots
love loved lover loves low lower lows luck lucky lump lumps lunch lung lunge lungs lure lured lures lush lust
lusts lute maids mail maim main maize make makes male males mall malls mama man mane mango mania manic manly
manor mans marry mars marsh mart marts mash mask masks mass mast masts mat match mate mates maths mats mean
means meant meat meats meet meets moan moans moat mob mobs mock mocks mode model mold molds moldy mole moles
molt molts mom mommy moms mon money mono month moo mood moon moons moor moors moose moot moots mop mope
mopes mops more morn morph moss mossy most moth moths motor motto mound mount mourn mouse mousy mouth moved mover
moves movie mow mowed mower mows much muck mucks mucky mud muddy muds muff muffs mug muggy mugs mum mums
munch musk musky muss must musty mut mute mutes mutt mutts myth myths nab nabs nail nails name named names
nap nape naps narc narcs navy nay near nears neat neck necks need needs needy neigh nice nicer nick nicks
night nine nip nits nix nods noise noisy norm norms north nose nosed noses nosey nosh nosy not notch note
noted notes noun nouns now nubs nude nudge nurse nut nuts nutty oafs oak oaks oar oars oat oats odd
odds off often old once one ones onion only onto onus oops open opine oral order organ other otter ought
over owl own pace pack pad pain pair pal pale pall palm pan paper part party pass past pat patch
path paw pay pea peak peal pear peas peck pen pence pend penny pens pep perky pest pets petty pew
pig piggy pigs pike pile piled piles pill pills pin pine pined pines pink pinks pinky pins pint pints pity
pivot pixel pizza place plaid plain plan plane plank plans plant plate play plays plaza plea pleas pleat pled plow
plows ploy ploys pluck plug plugs plum plumb plume plums plunk plus plush pock pod pods poem poems poke poked
pokes poll polls polo pomp pond ponds pony pool pools poop poops poor pop poppy pops pore pored pores pork
porky port ports pose posed poser poses posh posit post posts pot pots pouch pour pours pout pouts power pram
prams prank preen prep preps press prey preys price prick pride pried pries prim prime primp print prior privy prize
pro probe prod prods prof prom prompt proms prone prong proof prop props prose proud prove prow prowl proxy prude
prune pry pub pubs puce puck pud pudgy puff puffs puffy pug pugs puked pukes pull pulls pulp pulps puma
pumas pump pun punch punks punny puns punt punts puny pup pupil puppy pups pure purer purge purl purrs purse
pus push pushy puss pussy put puts putts putty pygmy pyre pyres quid quiet quill quilt quin quint quit quite
quits quiz quote quoth rabid race raced racer races rack racks racy radar radio raft rafts rag rage rages rail
rails rain rains rainy rais raise raj rake raked rakes rally ram ramp ramps rams ran ranch rand rang range
rank ranks rant rants rap rapid raps rate rated rates raw ray rays raze reach react read reads ready real
realm reap reaps rear rears rebel red reds reed reef reefs reek reel reels refer relax relay rely rent rents
rep repay repel reply rest rib ribs rice rich ride rider rides ridge rids ring rings rinse riot rip ripe
risen rises risk risks river road roads roam roams roar roars roast rob robe robes robin robot robs rock rocks
rocky rod rode rods roe roes role roles roll rolls romp romps room rooms roomy root roots rope roped ropes
rose roses rot rote rotor rots rove row rowed rower rows ruby rude ruff rugs ruin ruins rule ruled rules
rum rumor rump runs runt ruts rye sack sacks sad sage sago said sail sails sale sales salt salts salty
sand sandy sang sank sap saps sat sate saw sawed saws say says scab scabs scald scale scam scamp scams
scan scans scant scar scare scarf scars scary scene scent scoff scold scoop scoot score scorn scour scout scowl scrap
screw scrub scuba scuff scum sea seal seals seam seams see seed seeds seedy seek seems seen seep sees send
sends sense sent seven sew sewed sewn sews sex sexes shack shade shady shaft shake shaky shall sham shame shank
shape share shark sharp shave she shear shed sheep sheer sheet shelf shell shine shiny ship shirt shoes shone shoot
shore short shots shout shows shrub shrug shut sick sift sigh sight signs silk silly silo silt since sing sink
sips sir sit site six sixth sixty size sized sizes skim skin skins skip skirt skis skit sky slam slap
slaps slave slay sled slept slide slim sling slip slit slow small smart smash smell smelt smile smoke snake snare
snarl sneak sneer sniff snip snob snore snort snow soak soaps soar sob sober soda sofa soft sold sole soled
soles solid solo solos some son sons soon soot sops sore sores sorry sort sorts soup soups sour sours south
sow sowed sower sown sows spam spams span spans spare spark spat spats spawn spaws speak spear speed spell spend
spent spice spicy spied spies spike spiky spill spilt spin spine spins spit spite spits split spoil spoke spoon spore
spot spots spout spray spree sprig spry spud spuds spun spur spurs spurt spy squad squat squid stab stabs stack
staff stage stags stake stale stalk stall stamp stand star stare stars start state stay stays steak steal steam steel
steep steer stem stems step steps stern stick stiff still sting stink stint stir stirs stool stoop stop stops store
story stout stove stow stows strap straw stray strew strip stub stubs stuck stud study stuff stump stun stung stunt
sty style sub suck sucks suds sue sued sues sugar sun sung sunk sunny suns sup super surf surge sweet
swell swept swift swim swims swing swirl swish tea team teams tear tears teary tease teat teats tech teddy tee
teed teem teems teen teens teeny teeth tell tells ten tends tenor tens tent tenth tents terra tests testy text
texts thank that thaw thaws the them theme then there these they thick thief thigh thin thing think thins third
this thong thorn those thou three thru thud thug thugs thumb thump thus tide tides tidy tie tied tier tiers
ties tight tike till tills tilt tilts time timed timer times tin ting tinny tins tint tints tiny tip tips
tipsy tire tired tires toast toe toed toes toff tofu toil toils took tool toot tooth toots top tops touch
tough tow towed towel tower town towns toxic toxin toy toyed toys trace track tract trade trail train trait tram
tramp trap traps trash tray trays tread treat tree trees trek treks trend trim trims trip trips troll trunk truss
trust truth try trys tub tuba tube tubes tuck tug tugs tulip tummy tumor tump tumps tun tuna tunas tune
tuned tuner tunes turf turfs turn turns tush tusk tusks tut tutor tuts tux two under unit use usual value
very video vids view views vile vine vines vino viral visit vital viva vivid vixen vocal voice void vole voles
volt volts vote votes vow vowed vowel vows wad wade waded wades wag wage waged wager wagon wags waif waifs
wail wails waist wait waits waive wake waked wakes walk walks wall walls waltz wan wand wands wane wanes want
wants war ward wards ware wares warm warms warn warns warp warps wars wart warts warty wary wash washy wasps
wast water watt watts wave waved waver waves wavy wax waxed waxes way ways weak weal wean weans wear wears
weave web webs wed wedge weds wee weed weedy week weeks weep weeps weepy weft weigh weir weird weld welds
well wells welt welts wench wend wends went were west wet wets wha whack whale wham wharf what whee wheel
whelp where whets whey whims whin whine whiny whip whips whir whirl whirr whisk white whiz who whoa whole whom
whoop whorl whose why wick wide widen wider width wife wig wild wile wiles will wilt win wince wind winds
windy wing wink winks wipe wiped wiper wipes wire wired wires wiry wish wisp wisps wit witch with witty young
yours youth yowl yuck yucky yuk yum yummy yup yups yurt yurts
`.trim().split(/\s+/);
const EVERYDAY = new Set(EVERYDAY_RAW.filter(w => WORD_SET.has(w)));

// ── Rarity scoring ──
const COMMON_WORDS = new Set(['the','and','for','are','but','not','you','all','can','her','was','one','our','out','day','get','has','him','his','how','its','may','now','old','own','say','she','too','use','way','who','did','let','put','say','sit','too','ask']);
function getRarity(word) {
  if (word.length >= 7) return 'rare';
  if (word.length >= 5) return 'uncommon';
  if (COMMON_WORDS.has(word)) return 'common';
  return 'common';
}
function getRarityMult(word) {
  const r = getRarity(word);
  return r === 'rare' ? 5 : r === 'uncommon' ? 2 : 1;
}
function scoreWord(word) {
  return word.length * 10 * getRarityMult(word);
}

// ── Puzzle Generation ──
const GRID_SIZE = 5;
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

// Seeded RNG (mulberry32)
function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getDailySeed() {
  const d = new Date();
  return parseInt(`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`);
}

// Frequency-weighted letter distribution
const LETTER_FREQ = {
  A:8,B:2,C:3,D:4,E:12,F:2,G:2,H:3,I:7,K:1,L:4,M:2,N:6,O:8,P:2,R:6,S:6,T:9,U:4,V:1,W:2,Y:2
};
function buildLetterPool() {
  const pool = [];
  for (const [l, freq] of Object.entries(LETTER_FREQ)) {
    for (let i = 0; i < freq; i++) pool.push(l);
  }
  return pool;
}
const LETTER_POOL = buildLetterPool();

const VOWEL_POOL = LETTER_POOL.filter(l => 'AEIOU'.includes(l));
const CONSONANT_POOL = LETTER_POOL.filter(l => !'AEIOU'.includes(l));

function generateGrid(seed) {
  const rng = seededRng(seed);
  // 8 to 10 vowels and the rest consonants, each drawn by how common the letter is.
  // No letter more than 3 times (2 for the rarer ones), so a board can't fill up with I's.
  const letters = [];
  const count = {};
  const draw = (pool) => {
    for (;;) {
      const l = pool[Math.floor(rng() * pool.length)];
      const cap = LETTER_FREQ[l] <= 2 ? 2 : 3;
      if ((count[l] || 0) < cap) { count[l] = (count[l] || 0) + 1; return l; }
    }
  };
  const vowelCount = 8 + Math.floor(rng() * 3);
  for (let i = 0; i < vowelCount; i++) letters.push(draw(VOWEL_POOL));
  while (letters.length < 25) letters.push(draw(CONSONANT_POOL));
  // Shuffle
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters;
}

// BFS/DFS to find all valid words in grid
function findAllWords(grid) {
  const found = new Map(); // word -> [{path}]

  function dfs(row, col, visited, pathStr, currentWord, node) {
    const newWord = currentWord + grid[row * GRID_SIZE + col].toLowerCase();
    const newNode = node.children[grid[row * GRID_SIZE + col].toLowerCase()];
    if (!newNode) return;

    visited[row * GRID_SIZE + col] = true;

    if (newNode.isWord && newWord.length >= 3) {
      if (!found.has(newWord)) {
        found.set(newWord, [...pathStr, row * GRID_SIZE + col]);
      }
    }

    if (newWord.length < 8) {
      for (const [dr, dc] of DIRS) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
          const ni = nr * GRID_SIZE + nc;
          if (!visited[ni]) {
            dfs(nr, nc, visited, [...pathStr, row * GRID_SIZE + col], newWord, newNode);
          }
        }
      }
    }

    visited[row * GRID_SIZE + col] = false;
  }

  const visited = new Array(25).fill(false);
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      dfs(r, c, visited, [], '', TRIE.root);
    }
  }

  return found;
}

// Generate puzzle for a given date seed
const TARGET_COUNT = 12;
// [word length, how many]: the spec's 4 three-letter, 5 four-letter, 3 five-letter targets
const TARGET_MIX = [[3, 4], [4, 5], [5, 3]];
const holdsMix = (list) => TARGET_MIX.every(([len, n]) => list.filter(w => w.word.length === len).length >= n);

function generatePuzzle(seed) {
  seed = seed || getDailySeed();
  let grid, words, everyday;
  let attempts = 0;

  // Redraw until the board holds the full target mix (325 of 365 boards do on the first draw)
  do {
    grid = generateGrid(seed + attempts);
    const found = findAllWords(grid);
    // Filter to 3-8 letter words
    words = [];
    for (const [word, path] of found) {
      if (word.length >= 3 && word.length <= 8) {
        words.push({ word, path, score: scoreWord(word), rarity: getRarity(word) });
      }
    }
    everyday = words.filter(w => EVERYDAY.has(w.word));
    attempts++;
  } while (!holdsMix(everyday) && attempts < 30);

  // Any word on the board scores, but only everyday words are targets.
  // Shuffle them by the day's seed so the same letters don't always win, then fill each length.
  const pick = seededRng(seed * 31 + 7);
  for (let i = everyday.length - 1; i > 0; i--) {
    const j = Math.floor(pick() * (i + 1));
    [everyday[i], everyday[j]] = [everyday[j], everyday[i]];
  }
  const chosen = new Set();
  let carry = 0;
  // Longest first, so a missing five-letter word is replaced by a four, and a missing four by a three
  for (const [len, n] of [...TARGET_MIX].reverse()) {
    const got = everyday.filter(w => w.word.length === len).slice(0, n + carry);
    got.forEach(w => chosen.add(w));
    carry = n + carry - got.length;
  }
  for (const w of everyday) {
    if (chosen.size >= TARGET_COUNT) break;
    chosen.add(w);
  }
  const targetWords = [...chosen].slice(0, TARGET_COUNT)
    .sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word));

  return {
    grid,
    targetWords,
    allWords: new Map(words.map(w => [w.word, w])),
    seed,
    date: new Date().toISOString().slice(0, 10),
    minRequired: Math.min(12, Math.floor(targetWords.length * 0.6)),
  };
}

// Validate a word given current grid
function validateWordPath(word, grid) {
  const lower = word.toLowerCase();
  if (lower.length < 3) return null;
  if (!TRIE.isWord(lower)) return null;

  // BFS to find valid path
  function dfs(pos, idx, visited) {
    if (idx === lower.length) return visited.slice();
    for (const [dr, dc] of DIRS) {
      const r = Math.floor(pos / GRID_SIZE) + dr;
      const c = (pos % GRID_SIZE) + dc;
      const ni = r * GRID_SIZE + c;
      if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && !visited.includes(ni)) {
        if (grid[ni].toLowerCase() === lower[idx]) {
          const path = dfs(ni, idx + 1, [...visited, ni]);
          if (path) return path;
        }
      }
    }
    return null;
  }

  for (let start = 0; start < 25; start++) {
    if (grid[start].toLowerCase() === lower[0]) {
      const path = dfs(start, 1, [start]);
      if (path) return path;
    }
  }
  return null;
}

// Export
window.WordForgePuzzle = {
  generatePuzzle,
  validateWordPath,
  getDailySeed,
  scoreWord,
  getRarity,
  getRarityMult,
  GRID_SIZE,
  TRIE,
  WORD_SET,
};
