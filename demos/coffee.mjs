// Demo: coffee. One self-contained file: the questions Jev is asked, what the screen shows, and the arithmetic.
// (Copy demos/_template.mjs to make a new one, then add one line to demos/index.mjs.)
import { v, yes, low, pr, yn, ch } from './lib.mjs';

// What Jev is asked. Each key becomes a typed question; answers arrive as fields[key] = { value, confidence, p }.
const questions = {
  drink: ch({
    Latte: "A latte or caffe latte",
    Cappuccino: "A cappuccino",
    "Flat White": "A flat white",
    Espresso: "An espresso or short black",
    "Long Black": "A long black",
    Americano: "An americano",
    Mocha: "A mocha",
    Macchiato: "A macchiato, or an unqualified 'macchiato' (a short espresso with a dash of foam)",
    "Long Macchiato": "A long macchiato (double espresso, dash of milk)",
    Cortado: "A cortado",
    Piccolo: "A piccolo or piccolo latte (a single ristretto with steamed milk in a small glass)",
    Magic: "A magic (a double ristretto with steamed milk in a small cup, a Melbourne order)",
    "Long Mac Topped Up": "A long mac topped up (a long macchiato topped up with steamed milk)",
    Babycino: "A babycino (frothy milk for a child, no coffee)",
    "Drip Coffee": "Drip, filter, batch brew or 'regular coffee'",
    "Cold Brew": "Cold brew coffee",
    Cafecito: "A cafecito or Cuban espresso",
    "Secret Menu": "A nickname or viral secret-menu name (e.g. Butterbeer, Pinkity Drinkity) with no base drink",
    None: "No drink named yet",
  }),
  size: ch({
    Small: "Small size",
    Medium: "Medium size",
    Large: "Large or big size",
    Trenta: "Trenta or the very biggest size",
    Unspecified: "No size mentioned",
  }),
  milk: ch({
    Oat: "Oat milk",
    Almond: "Almond milk",
    Soy: "Soy milk",
    Skim: "Skim or low fat milk",
    "Full cream": "Full cream or regular dairy milk",
    Split: "Two or more milks mixed (e.g. half almond, half oat)",
    None: "No milk, or a black coffee",
    Unspecified: "Milk not mentioned",
  }),
  extra_shot: yn("Customer asks for an extra, double or additional shot", "No extra shot requested"),
  croissant: yn("Customer asks for a croissant", "No croissant requested"),
  muffin: yn("Customer asks for a muffin", "No muffin requested"),
  cookie: yn("Customer asks for a cookie or biscuit", "No cookie requested"),
  syrup: yn("Customer asks for a syrup such as vanilla or caramel", "No syrup requested"),
  caf: ch({ Normal: "Normal caffeine", Half: "Half-caf or half-strength", Decaf: "Decaf" }),
  extra_hot: yn("Customer asks for extra hot or very hot", "No extra-hot request"),
  iced: yn("The drink is iced, over ice, or cold", "The drink is hot"),
  no_foam: yn("Customer asks for no foam, or flat milk", "No foam request"),
  no_ice_milk_top: yn("Iced drink with no ice and milk filled to the top", "No such request"),
  regular_word: yn("Customer says 'regular' for the coffee without saying what they mean", "Does not use the word regular"),
  outside_blend: yn("Customer asks to blend a cake, brownie or other outside food into the drink", "No blending request"),
  sugar_in_shot: yn("Customer wants sugar brewed or whipped into the espresso", "No sugar-in-shot request"),
};

// ---------- COFFEE (home) ----------
const stock = { Oat: true, Almond: 'low', Soy: false, Skim: true, 'Full cream': true, croissant: false, cookie: false, muffin: true, extra_shot: true, syrup: true };
const COLD_OK = ['Cold Brew'];
const coffee = {
  id: 'coffee', tab: 'Coffee', title: ['Jev', 'Coffee'],
  say: 'Tap the mic and say your order',
  // Unusual orders rotate one at a time under the mic so the fields keep the screen.
  chips: [
    'A flat white please',
    'A no-foam cappuccino, half almond half oat, extra hot',
    'Just a macchiato',
    'Iced latte with no ice and milk to the top',
    'A regular coffee',
    'A trenta hot latte',
    'A cafecito with the sugar brewed in',
    'A Pinkity Drinkity',
    'Blend my brownie into a frappe',
    'A long macchiato with a sausage dog please',
    'A piccolo and a cookie',
    'A magic with almond milk',
    'Long mac topped up',
    'A babycino for the kid',
  ],
  labels: ['Drink', 'Size', 'Milk', 'Temp', 'Extras', 'Food'],
  confirm: 'Confirm order',
  maxFlags: 3,
  render(f) {
    const drink = f.drink && f.drink.value !== 'None' ? v(f, 'drink') : null;
    const sizeV = f.size && f.size.value !== 'Unspecified' && (f.size.confidence == null || f.size.confidence >= 0.6) ? v(f, 'size') : null;
    const size = sizeV || (drink ? 'Medium' : null);
    const milk = f.milk && f.milk.value !== 'Unspecified' ? v(f, 'milk') : null;
    const iced = yes(f, 'iced') && (f.iced.confidence == null || f.iced.confidence >= 0.6);
    const mods = [], food = [];
    if (yes(f, 'extra_shot')) mods.push('Extra shot');
    if (yes(f, 'syrup')) mods.push('Vanilla syrup');
    if (v(f, 'caf') === 'Half') mods.push('Half-caf'); if (v(f, 'caf') === 'Decaf') mods.push('Decaf');
    if (yes(f, 'no_foam')) mods.push('No foam');
    if (yes(f, 'sugar_in_shot')) mods.push('Sugar in shot');
    if (yes(f, 'croissant')) food.push('Croissant');
    if (yes(f, 'muffin')) food.push('Muffin');
    if (yes(f, 'cookie')) food.push('Cookie');
    const hot = yes(f, 'extra_hot');
    const temp = drink ? (iced ? (yes(f, 'no_ice_milk_top') ? 'Iced, no ice' : 'Iced') + (hot ? ', extra hot' : '') : (hot ? 'Extra hot' : 'Hot')) : null;

    const flags = [];
    const add = (m, s) => flags.push({ m, s });
    if (milk && stock[milk] === false) add(milk + ' milk out of stock', 'out');
    if (milk && stock[milk] === 'low') add(milk + ' milk running low: oat is ready', 'warn');
    if (yes(f, 'cookie') && !stock.cookie) add('Cookies unavailable: try a muffin', 'out');
    if (yes(f, 'croissant') && !stock.croissant) add('Croissant unavailable: try a muffin', 'out');
    if (yes(f, 'muffin') && !stock.muffin) add('Muffin unavailable', 'out');
    if (yes(f, 'extra_shot') && !stock.extra_shot) add('Extra shots limited', 'warn');
    if (yes(f, 'outside_blend')) add('Can’t blend outside food', 'out');
    if (sizeV === 'Trenta' && !iced && !COLD_OK.includes(drink)) add('Trenta is for cold drinks only', 'out');
    if (drink === 'Secret Menu') add('Nickname only: ask the base drink and syrups', 'warn');
    if (yes(f, 'no_foam') && drink === 'Cappuccino') add('No-foam cappuccino is a latte: confirm', 'warn');
    if (drink === 'Macchiato') add('Macchiato: short espresso with foam, or a sweet caramel one?', 'warn');
    if (v(f, 'milk') === 'Split') add('Split milks: confirm the ratio', 'warn');
    if (iced && yes(f, 'extra_hot')) add('Extra hot on a cold drink: clarify', 'warn');
    if (yes(f, 'no_ice_milk_top')) add('No ice, milk to the top: latte or just a splash?', 'warn');
    if (yes(f, 'regular_word')) add('“Regular” is unclear: ask size and milk', 'warn');
    if (drink === 'Cafecito' || yes(f, 'sugar_in_shot')) add('Cafecito: whip sugar into the first drops, not the puck', 'warn');
    if (drink && !milk && !['Espresso', 'Long Black', 'Americano', 'Cafecito', 'Cold Brew', 'Drip Coffee', 'Secret Menu', 'Babycino'].includes(drink)) add('Milk not heard: ask customer', 'warn');
    const INFO = { Piccolo: 'Piccolo: single ristretto, small glass', Magic: 'Magic: double ristretto, small cup, Melbourne style', 'Long Mac Topped Up': 'Long mac topped up: charge as long mac plus milk', Babycino: 'Babycino: froth for the kids, no coffee' };
    if (INFO[drink]) add(INFO[drink], drink === 'Long Mac Topped Up' ? 'warn' : 'ok');
    if (drink && !flags.length) add('No stock issues', 'ok');
    flags.sort((x, y) => ({ out: 0, warn: 1, ok: 2 })[x.s] - ({ out: 0, warn: 1, ok: 2 })[y.s]);
    return {
      rows: [[drink, low(f, 'drink')], [size, low(f, 'size') && !!sizeV], [milk === 'Split' ? 'Split milks' : milk, low(f, 'milk')], [temp], [mods.length ? mods.join(', ') : (drink ? 'None' : null)], [food.length ? food.join(', ') : (drink ? 'None' : null)]],
      flags, ok: !!drink && !flags.some((x) => x.s === 'out'),
      toast: [size, drink].filter(Boolean).join(' ') + (milk && milk !== 'None' ? ' · ' + milk : ''),
    };
  },
};

export default Object.assign(coffee, {
  ctx: "Customer speaking a coffee order at a cafe counter.",
  questions,
});
