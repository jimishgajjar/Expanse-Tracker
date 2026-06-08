import {
  // money / accounts
  Wallet, WalletCards, Banknote, Landmark, CreditCard, PiggyBank, Coins, HandCoins, Vault,
  DollarSign, Euro, PoundSterling, IndianRupee, JapaneseYen, Bitcoin, Receipt, ReceiptText,
  BadgeDollarSign, BadgePercent, Calculator, Scale, TrendingUp, TrendingDown, Gem, Crown,
  // food / drink
  Utensils, UtensilsCrossed, Coffee, Pizza, ShoppingBasket, Beer, Wine, Apple, Salad, Sandwich,
  Soup, IceCreamCone, Cake, CakeSlice, Beef, Fish, Egg, Croissant, Cookie, CupSoda, Milk, Candy,
  Donut, Carrot, Cherry, Grape, Wheat, Drumstick, Popcorn, Martini,
  // home / bills
  House, Building, Building2, Plug, PlugZap, Lightbulb, Droplet, Droplets, Flame, Wifi, Zap,
  Thermometer, Fan, Refrigerator, WashingMachine, Microwave, Lamp, BedDouble, Bath, ShowerHead,
  Sofa, DoorOpen, Key, KeyRound, Trash2, Recycle, Hammer, Wrench, Drill, Ruler, Paintbrush,
  PaintRoller, Sprout, TreePine, Trees, Flower2, Shovel,
  // transport
  Car, CarFront, CarTaxiFront, Bus, Fuel, Plane, PlaneTakeoff, TrainFront, Bike, Truck, Ship,
  Sailboat, Anchor, Caravan, Footprints, Rocket, MapPin, Map, Compass, Navigation, Luggage,
  // shopping / lifestyle
  ShoppingBag, ShoppingCart, Shirt, Gift, Scissors, Smartphone, Tag, Tags, Glasses, Watch,
  Backpack, Umbrella, Sparkles, Palette, Camera, Headphones, Ticket, PartyPopper, Cigarette,
  // health / fitness
  HeartPulse, Stethoscope, Pill, Dumbbell, Activity, Cross, Syringe, Bandage, Brain, Bone, Eye,
  Hospital, Ambulance, FlaskConical,
  // fun / education
  Clapperboard, Film, Music, Gamepad2, GraduationCap, Book, BookOpen, Library, Tv, Dices, Puzzle,
  Drama, Pencil, Notebook, Radio, Newspaper,
  // work / tech
  Briefcase, Laptop, Monitor, Keyboard, Printer, Server, Database, Code, Terminal, Factory, Store,
  Warehouse, Mail, Send, Phone, Bell,
  // people / family
  User, Users, UserPlus, Baby, Dog, Cat, Bird, PawPrint, Heart, Smile, Handshake, HandHeart,
  // misc / nature
  Star, Calendar, Clock, Globe, Shield, Lock, Flag, Bookmark, Award, Trophy, Target, Sun, Moon,
  Cloud, CloudRain, Snowflake, Leaf, Mountain, Tent, CircleHelp,
  type LucideIcon,
} from "lucide-react";

// Static registry — every icon offered in the picker (rendered instantly, no
// lazy flicker in lists). Keys are kebab-case; ICON_NAMES is derived from these
// so the picker list can never drift from what's renderable.
const MAP: Record<string, LucideIcon> = {
  "wallet": Wallet, "wallet-cards": WalletCards, "banknote": Banknote, "landmark": Landmark,
  "credit-card": CreditCard, "piggy-bank": PiggyBank, "coins": Coins, "hand-coins": HandCoins,
  "vault": Vault, "dollar-sign": DollarSign, "euro": Euro, "pound-sterling": PoundSterling,
  "indian-rupee": IndianRupee, "japanese-yen": JapaneseYen, "bitcoin": Bitcoin, "receipt": Receipt,
  "receipt-text": ReceiptText, "badge-dollar-sign": BadgeDollarSign, "badge-percent": BadgePercent,
  "calculator": Calculator, "scale": Scale, "trending-up": TrendingUp, "trending-down": TrendingDown,
  "gem": Gem, "crown": Crown,
  "utensils": Utensils, "utensils-crossed": UtensilsCrossed, "coffee": Coffee, "pizza": Pizza,
  "shopping-basket": ShoppingBasket, "beer": Beer, "wine": Wine, "apple": Apple, "salad": Salad,
  "sandwich": Sandwich, "soup": Soup, "ice-cream-cone": IceCreamCone, "cake": Cake,
  "cake-slice": CakeSlice, "beef": Beef, "fish": Fish, "egg": Egg, "croissant": Croissant,
  "cookie": Cookie, "cup-soda": CupSoda, "milk": Milk, "candy": Candy, "donut": Donut,
  "carrot": Carrot, "cherry": Cherry, "grape": Grape, "wheat": Wheat, "drumstick": Drumstick,
  "popcorn": Popcorn, "martini": Martini,
  "house": House, "building": Building, "building-2": Building2, "plug": Plug, "plug-zap": PlugZap,
  "lightbulb": Lightbulb, "droplet": Droplet, "droplets": Droplets, "flame": Flame, "wifi": Wifi,
  "zap": Zap, "thermometer": Thermometer, "fan": Fan, "refrigerator": Refrigerator,
  "washing-machine": WashingMachine, "microwave": Microwave, "lamp": Lamp, "bed-double": BedDouble,
  "bath": Bath, "shower-head": ShowerHead, "sofa": Sofa, "door-open": DoorOpen, "key": Key,
  "key-round": KeyRound, "trash-2": Trash2, "recycle": Recycle, "hammer": Hammer, "wrench": Wrench,
  "drill": Drill, "ruler": Ruler, "paintbrush": Paintbrush, "paint-roller": PaintRoller,
  "sprout": Sprout, "tree-pine": TreePine, "trees": Trees, "flower-2": Flower2, "shovel": Shovel,
  "car": Car, "car-front": CarFront, "car-taxi-front": CarTaxiFront, "bus": Bus, "fuel": Fuel,
  "plane": Plane, "plane-takeoff": PlaneTakeoff, "train-front": TrainFront, "bike": Bike,
  "truck": Truck, "ship": Ship, "sailboat": Sailboat, "anchor": Anchor, "caravan": Caravan,
  "footprints": Footprints, "rocket": Rocket, "map-pin": MapPin, "map": Map,
  "compass": Compass, "navigation": Navigation, "luggage": Luggage,
  "shopping-bag": ShoppingBag, "shopping-cart": ShoppingCart, "shirt": Shirt, "gift": Gift,
  "scissors": Scissors, "smartphone": Smartphone, "tag": Tag, "tags": Tags, "glasses": Glasses,
  "watch": Watch, "backpack": Backpack, "umbrella": Umbrella, "sparkles": Sparkles,
  "palette": Palette, "camera": Camera, "headphones": Headphones, "ticket": Ticket,
  "party-popper": PartyPopper, "cigarette": Cigarette,
  "heart-pulse": HeartPulse, "stethoscope": Stethoscope, "pill": Pill, "dumbbell": Dumbbell,
  "activity": Activity, "cross": Cross, "syringe": Syringe, "bandage": Bandage, "brain": Brain,
  "bone": Bone, "eye": Eye, "hospital": Hospital, "ambulance": Ambulance, "flask-conical": FlaskConical,
  "clapperboard": Clapperboard, "film": Film, "music": Music, "gamepad-2": Gamepad2,
  "graduation-cap": GraduationCap, "book": Book, "book-open": BookOpen, "library": Library,
  "tv": Tv, "dices": Dices, "puzzle": Puzzle, "drama": Drama, "pencil": Pencil, "notebook": Notebook,
  "radio": Radio, "newspaper": Newspaper,
  "briefcase": Briefcase, "laptop": Laptop, "monitor": Monitor, "keyboard": Keyboard,
  "printer": Printer, "server": Server, "database": Database, "code": Code, "terminal": Terminal,
  "factory": Factory, "store": Store, "warehouse": Warehouse, "mail": Mail, "send": Send,
  "phone": Phone, "bell": Bell,
  "user": User, "users": Users, "user-plus": UserPlus, "baby": Baby, "dog": Dog, "cat": Cat,
  "bird": Bird, "paw-print": PawPrint, "heart": Heart, "smile": Smile, "handshake": Handshake,
  "hand-heart": HandHeart,
  "star": Star, "calendar": Calendar, "clock": Clock, "globe": Globe, "shield": Shield,
  "lock": Lock, "flag": Flag, "bookmark": Bookmark, "award": Award, "trophy": Trophy,
  "target": Target, "sun": Sun, "moon": Moon, "cloud": Cloud, "cloud-rain": CloudRain,
  "snowflake": Snowflake, "leaf": Leaf, "mountain": Mountain, "tent": Tent, "circle-help": CircleHelp,
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
