import {
  // Finance & Money
  Wallet, WalletCards, Banknote, Landmark, CreditCard, PiggyBank, Coins, HandCoins, Vault,
  DollarSign, Euro, PoundSterling, IndianRupee, JapaneseYen, Bitcoin, Receipt, ReceiptText,
  BadgeDollarSign, BadgePercent, Calculator, Scale, TrendingUp, TrendingDown, Gem, Crown,
  ChartPie, ChartBar, CircleDollarSign, Percent,
  // Food & Dining
  Utensils, UtensilsCrossed, Coffee, Pizza, ShoppingBasket, Beer, Wine, Apple, Salad, Sandwich,
  Soup, IceCreamCone, Cake, CakeSlice, Beef, Fish, Egg, Croissant, Cookie, CupSoda, Milk,
  Candy, Donut, Carrot, Cherry, Grape, Wheat, Drumstick, Popcorn, Martini, CookingPot,
  GlassWater, Citrus, Banana,
  // Home & Bills
  House, Building, Building2, Plug, PlugZap, Lightbulb, Droplet, Droplets, Flame, Wifi,
  Zap, Thermometer, Fan, Refrigerator, WashingMachine, Microwave, Lamp, BedDouble, Bath,
  ShowerHead, Sofa, DoorOpen, Key, KeyRound, Trash2, Recycle, Hammer, Wrench, Drill, Ruler,
  Paintbrush, PaintRoller, Sprout, TreePine, Trees, Flower2, Shovel, SunMedium, Heater,
  // Transport & Travel
  Car, CarFront, CarTaxiFront, Bus, BusFront, Fuel, Plane, PlaneTakeoff, TrainFront, Bike,
  Truck, Ship, Sailboat, Anchor, Caravan, Footprints, Rocket, MapPin, Map, Compass,
  Navigation, Luggage, Ticket, CableCar, TramFront, CircleParking,
  // Shopping & Retail
  ShoppingBag, ShoppingCart, Shirt, Gift, Scissors, Smartphone, Tag, Tags, Glasses, Watch,
  Backpack, Umbrella, Sparkles, Palette, Camera, Headphones, PartyPopper, Cigarette, Package,
  PackageOpen, Boxes, BadgeCheck, Store, Diamond,
  // Health & Wellness
  HeartPulse, Stethoscope, Pill, Dumbbell, Activity, Cross, Syringe, Bandage, Brain, Bone,
  Eye, Hospital, Ambulance, FlaskConical, ShieldPlus, HeartHandshake,
  // Entertainment & Media
  Clapperboard, Film, Music, Gamepad2, Tv, Dices, Puzzle, Drama, Radio, Newspaper, Disc,
  Volume2, Trophy, Medal, Joystick, CassetteTape,
  // Tech & Work
  Briefcase, Laptop, Monitor, Keyboard, Printer, Server, Database, Code, Terminal, Factory,
  Warehouse, Mail, Send, Phone, Bell, Cpu, Cloud, Bot, HardDrive, Repeat, CalendarClock,
  // People & Family & Pets
  User, Users, UserPlus, Baby, Dog, Cat, Bird, PawPrint, Heart, Smile, Handshake, HandHeart,
  School, GraduationCap, Book, BookOpen, Library, Pencil, Notebook,
  // Misc
  Star, Calendar, Clock, Globe, Shield, Lock, Flag, Bookmark, Award, Target, Sun, Moon,
  CloudRain, Snowflake, Leaf, Mountain, Tent, CircleHelp,
  type LucideIcon,
} from "lucide-react";

// Static registry — every icon offered in the picker (rendered instantly, no lazy flicker)
const MAP: Record<string, LucideIcon> = {
  // Finance & Money
  "wallet": Wallet, "wallet-cards": WalletCards, "banknote": Banknote, "landmark": Landmark,
  "credit-card": CreditCard, "piggy-bank": PiggyBank, "coins": Coins, "hand-coins": HandCoins,
  "vault": Vault, "dollar-sign": DollarSign, "euro": Euro, "pound-sterling": PoundSterling,
  "indian-rupee": IndianRupee, "japanese-yen": JapaneseYen, "bitcoin": Bitcoin, "receipt": Receipt,
  "receipt-text": ReceiptText, "badge-dollar-sign": BadgeDollarSign, "badge-percent": BadgePercent,
  "calculator": Calculator, "scale": Scale, "trending-up": TrendingUp, "trending-down": TrendingDown,
  "gem": Gem, "crown": Crown, "chart-pie": ChartPie, "chart-bar": ChartBar,
  "circle-dollar-sign": CircleDollarSign, "percent": Percent,

  // Food & Dining
  "utensils": Utensils, "utensils-crossed": UtensilsCrossed, "coffee": Coffee, "pizza": Pizza,
  "shopping-basket": ShoppingBasket, "beer": Beer, "wine": Wine, "apple": Apple, "salad": Salad,
  "sandwich": Sandwich, "soup": Soup, "ice-cream-cone": IceCreamCone, "cake": Cake,
  "cake-slice": CakeSlice, "beef": Beef, "fish": Fish, "egg": Egg, "croissant": Croissant,
  "cookie": Cookie, "cup-soda": CupSoda, "milk": Milk, "candy": Candy, "donut": Donut,
  "carrot": Carrot, "cherry": Cherry, "grape": Grape, "wheat": Wheat, "drumstick": Drumstick,
  "popcorn": Popcorn, "martini": Martini, "cooking-pot": CookingPot, "glass-water": GlassWater,
  "citrus": Citrus, "banana": Banana,

  // Home & Bills
  "house": House, "building": Building, "building-2": Building2, "plug": Plug, "plug-zap": PlugZap,
  "lightbulb": Lightbulb, "droplet": Droplet, "droplets": Droplets, "flame": Flame, "wifi": Wifi,
  "zap": Zap, "thermometer": Thermometer, "fan": Fan, "refrigerator": Refrigerator,
  "washing-machine": WashingMachine, "microwave": Microwave, "lamp": Lamp, "bed-double": BedDouble,
  "bath": Bath, "shower-head": ShowerHead, "sofa": Sofa, "door-open": DoorOpen, "key": Key,
  "key-round": KeyRound, "trash-2": Trash2, "recycle": Recycle, "hammer": Hammer, "wrench": Wrench,
  "drill": Drill, "ruler": Ruler, "paintbrush": Paintbrush, "paint-roller": PaintRoller,
  "sprout": Sprout, "tree-pine": TreePine, "trees": Trees, "flower-2": Flower2, "shovel": Shovel,
  "sun-medium": SunMedium, "heater": Heater,

  // Transport & Travel
  "car": Car, "car-front": CarFront, "car-taxi-front": CarTaxiFront, "bus": Bus, "bus-front": BusFront,
  "fuel": Fuel, "plane": Plane, "plane-takeoff": PlaneTakeoff, "train-front": TrainFront, "bike": Bike,
  "truck": Truck, "ship": Ship, "sailboat": Sailboat, "anchor": Anchor, "caravan": Caravan,
  "footprints": Footprints, "rocket": Rocket, "map-pin": MapPin, "map": Map,
  "compass": Compass, "navigation": Navigation, "luggage": Luggage, "ticket": Ticket,
  "cable-car": CableCar, "tram-front": TramFront, "circle-parking": CircleParking,

  // Shopping & Retail
  "shopping-bag": ShoppingBag, "shopping-cart": ShoppingCart, "shirt": Shirt, "gift": Gift,
  "scissors": Scissors, "smartphone": Smartphone, "tag": Tag, "tags": Tags, "glasses": Glasses,
  "watch": Watch, "backpack": Backpack, "umbrella": Umbrella, "sparkles": Sparkles,
  "palette": Palette, "camera": Camera, "headphones": Headphones, "party-popper": PartyPopper,
  "cigarette": Cigarette, "package": Package, "package-open": PackageOpen, "boxes": Boxes,
  "badge-check": BadgeCheck, "store": Store, "diamond": Diamond,

  // Health & Wellness
  "heart-pulse": HeartPulse, "stethoscope": Stethoscope, "pill": Pill, "dumbbell": Dumbbell,
  "activity": Activity, "cross": Cross, "syringe": Syringe, "bandage": Bandage, "brain": Brain,
  "bone": Bone, "eye": Eye, "hospital": Hospital, "ambulance": Ambulance, "flask-conical": FlaskConical,
  "shield-plus": ShieldPlus, "heart-handshake": HeartHandshake,

  // Entertainment & Media
  "clapperboard": Clapperboard, "film": Film, "music": Music, "gamepad-2": Gamepad2,
  "tv": Tv, "dices": Dices, "puzzle": Puzzle, "drama": Drama, "radio": Radio,
  "newspaper": Newspaper, "disc": Disc, "volume-2": Volume2, "trophy": Trophy,
  "medal": Medal, "joystick": Joystick, "cassette-tape": CassetteTape,

  // Tech & Work
  "briefcase": Briefcase, "laptop": Laptop, "monitor": Monitor, "keyboard": Keyboard,
  "printer": Printer, "server": Server, "database": Database, "code": Code, "terminal": Terminal,
  "factory": Factory, "warehouse": Warehouse, "mail": Mail, "send": Send,
  "phone": Phone, "bell": Bell, "cpu": Cpu, "cloud": Cloud, "bot": Bot,
  "hard-drive": HardDrive, "repeat": Repeat, "calendar-clock": CalendarClock,

  // People & Family & Pets
  "user": User, "users": Users, "user-plus": UserPlus, "baby": Baby, "dog": Dog, "cat": Cat,
  "bird": Bird, "paw-print": PawPrint, "heart": Heart, "smile": Smile, "handshake": Handshake,
  "hand-heart": HandHeart, "school": School, "graduation-cap": GraduationCap, "book": Book,
  "book-open": BookOpen, "library": Library, "pencil": Pencil, "notebook": Notebook,

  // Misc
  "star": Star, "calendar": Calendar, "clock": Clock, "globe": Globe, "shield": Shield,
  "lock": Lock, "flag": Flag, "bookmark": Bookmark, "award": Award, "target": Target,
  "sun": Sun, "moon": Moon, "cloud-rain": CloudRain, "snowflake": Snowflake, "leaf": Leaf,
  "mountain": Mountain, "tent": Tent, "circle-help": CircleHelp,
};

export interface IconCategoryGroup {
  id: string;
  name: string;
  icons: string[];
}

export const ICON_CATEGORY_GROUPS: IconCategoryGroup[] = [
  {
    id: "finance",
    name: "Finance & Money",
    icons: [
      "wallet", "wallet-cards", "banknote", "landmark", "credit-card", "piggy-bank",
      "coins", "hand-coins", "vault", "dollar-sign", "euro", "pound-sterling",
      "indian-rupee", "japanese-yen", "bitcoin", "receipt", "receipt-text",
      "badge-dollar-sign", "badge-percent", "calculator", "scale", "trending-up",
      "trending-down", "gem", "crown", "chart-pie", "chart-bar", "circle-dollar-sign", "percent"
    ],
  },
  {
    id: "food",
    name: "Food & Dining",
    icons: [
      "utensils", "utensils-crossed", "coffee", "pizza", "shopping-basket", "beer", "wine",
      "apple", "salad", "sandwich", "soup", "ice-cream-cone", "cake", "cake-slice",
      "beef", "fish", "egg", "croissant", "cookie", "cup-soda", "milk", "candy", "donut",
      "carrot", "cherry", "grape", "wheat", "drumstick", "popcorn", "martini",
      "cooking-pot", "glass-water", "citrus", "banana"
    ],
  },
  {
    id: "home",
    name: "Home & Bills",
    icons: [
      "house", "building", "building-2", "plug", "plug-zap", "lightbulb", "droplet",
      "droplets", "flame", "wifi", "zap", "thermometer", "fan", "refrigerator",
      "washing-machine", "microwave", "lamp", "bed-double", "bath", "shower-head",
      "sofa", "door-open", "key", "key-round", "trash-2", "recycle", "hammer",
      "wrench", "drill", "ruler", "paintbrush", "paint-roller", "sprout", "tree-pine",
      "trees", "flower-2", "shovel", "sun-medium", "heater"
    ],
  },
  {
    id: "transport",
    name: "Transport & Travel",
    icons: [
      "car", "car-front", "car-taxi-front", "bus", "bus-front", "fuel", "plane",
      "plane-takeoff", "train-front", "bike", "truck", "ship", "sailboat", "anchor",
      "caravan", "footprints", "rocket", "map-pin", "map", "compass", "navigation",
      "luggage", "ticket", "cable-car", "tram-front", "circle-parking"
    ],
  },
  {
    id: "shopping",
    name: "Shopping & Lifestyle",
    icons: [
      "shopping-bag", "shopping-cart", "shirt", "gift", "scissors", "smartphone",
      "tag", "tags", "glasses", "watch", "backpack", "umbrella", "sparkles",
      "palette", "camera", "headphones", "party-popper", "cigarette", "package",
      "package-open", "boxes", "badge-check", "store", "diamond"
    ],
  },
  {
    id: "health",
    name: "Health & Fitness",
    icons: [
      "heart-pulse", "stethoscope", "pill", "dumbbell", "activity", "cross",
      "syringe", "bandage", "brain", "bone", "eye", "hospital", "ambulance",
      "flask-conical", "shield-plus", "heart-handshake"
    ],
  },
  {
    id: "entertainment",
    name: "Fun & Media",
    icons: [
      "clapperboard", "film", "music", "gamepad-2", "tv", "dices", "puzzle",
      "drama", "radio", "newspaper", "disc", "volume-2", "trophy", "medal",
      "joystick", "cassette-tape"
    ],
  },
  {
    id: "tech",
    name: "Tech & Work",
    icons: [
      "briefcase", "laptop", "monitor", "keyboard", "printer", "server", "database",
      "code", "terminal", "factory", "warehouse", "mail", "send", "phone", "bell",
      "cpu", "cloud", "bot", "hard-drive", "repeat", "calendar-clock"
    ],
  },
  {
    id: "family",
    name: "Family & Pets",
    icons: [
      "user", "users", "user-plus", "baby", "dog", "cat", "bird", "paw-print",
      "heart", "smile", "handshake", "hand-heart", "school", "graduation-cap",
      "book", "book-open", "library", "pencil", "notebook"
    ],
  },
  {
    id: "misc",
    name: "Nature & General",
    icons: [
      "star", "calendar", "clock", "globe", "shield", "lock", "flag", "bookmark",
      "award", "target", "sun", "moon", "cloud-rain", "snowflake", "leaf",
      "mountain", "tent", "circle-help"
    ],
  },
];

/** Search tags map to allow finding icons by everyday words (e.g. "flight" -> "plane") */
export const ICON_SEARCH_TAGS: Record<string, string[]> = {
  "plane": ["flight", "travel", "vacation", "trip", "airline", "airport"],
  "car": ["vehicle", "auto", "drive", "gas", "commute", "uber"],
  "fuel": ["gas", "petrol", "diesel", "station", "charge"],
  "coffee": ["cafe", "starbucks", "espresso", "latte", "breakfast", "drink"],
  "utensils": ["food", "dinner", "lunch", "restaurant", "dining", "meal", "eat"],
  "pizza": ["takeout", "fast food", "dinner", "delivery"],
  "shopping-basket": ["groceries", "supermarket", "food", "market", "costco"],
  "house": ["home", "rent", "mortgage", "housing", "apartment"],
  "zap": ["electricity", "electric", "power", "energy", "utility"],
  "wifi": ["internet", "broadband", "network", "web"],
  "film": ["movies", "netflix", "cinema", "entertainment", "streaming"],
  "tv": ["television", "netflix", "hulu", "streaming", "shows"],
  "gamepad-2": ["games", "gaming", "steam", "playstation", "xbox"],
  "dumbbell": ["gym", "fitness", "workout", "exercise", "training"],
  "heart-pulse": ["health", "medical", "doctor", "hospital", "clinic"],
  "pill": ["pharmacy", "medicine", "prescription", "drugs"],
  "banknote": ["cash", "money", "salary", "income", "paycheck"],
  "piggy-bank": ["savings", "deposit", "fund", "future"],
  "trending-up": ["investment", "stocks", "growth", "dividends", "gain"],
  "laptop": ["computer", "work", "tech", "hardware", "software", "subscription"],
  "briefcase": ["work", "job", "career", "business", "consulting"],
  "gift": ["present", "holiday", "birthday", "donation", "charity"],
  "graduation-cap": ["education", "tuition", "school", "college", "course", "degree"],
  "dog": ["pet", "puppy", "vet", "veterinary"],
  "cat": ["pet", "kitten", "vet"],
};

/** All icon names offered in the picker (derived from MAP — always in sync). */
export const ICON_NAMES: string[] = Object.keys(MAP);

/** Renders a lucide icon by its kebab-case name (falls back to a tag icon). */
export function Icon({
  name,
  className,
  size = 16,
  color,
  strokeWidth,
}: {
  name?: string | null;
  className?: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Cmp = MAP[name ?? ""] ?? Tag;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} className={className} />;
}
