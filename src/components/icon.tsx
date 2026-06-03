import {
  Wallet, Banknote, Landmark, CreditCard, PiggyBank, Coins, HandCoins, Vault,
  Utensils, Coffee, Pizza, ShoppingBasket, Beer, Wine, Apple,
  House, Receipt, Plug, Lightbulb, Droplet, Flame, Wifi, Zap,
  Car, Bus, Fuel, Plane, TrainFront, Bike,
  ShoppingBag, ShoppingCart, Shirt, Gift, Scissors, Smartphone,
  HeartPulse, Stethoscope, Pill, Dumbbell, Activity,
  Clapperboard, Film, Music, Gamepad2, GraduationCap, Book, Tv,
  Briefcase, Laptop, TrendingUp, BadgeDollarSign, Building2,
  Tag, Star, Heart, Dog, Baby, Wrench, Phone, CircleHelp,
  type LucideIcon,
} from "lucide-react";

// Static registry — only the icons offered in the picker plus fallbacks.
// (Avoids lucide-react/dynamic, which pulls every icon into the bundle graph.)
const MAP: Record<string, LucideIcon> = {
  "wallet": Wallet, "banknote": Banknote, "landmark": Landmark, "credit-card": CreditCard,
  "piggy-bank": PiggyBank, "coins": Coins, "hand-coins": HandCoins, "vault": Vault,
  "utensils": Utensils, "coffee": Coffee, "pizza": Pizza, "shopping-basket": ShoppingBasket,
  "beer": Beer, "wine": Wine, "apple": Apple,
  "house": House, "receipt": Receipt, "plug": Plug, "lightbulb": Lightbulb,
  "droplet": Droplet, "flame": Flame, "wifi": Wifi, "zap": Zap,
  "car": Car, "bus": Bus, "fuel": Fuel, "plane": Plane, "train-front": TrainFront, "bike": Bike,
  "shopping-bag": ShoppingBag, "shopping-cart": ShoppingCart, "shirt": Shirt, "gift": Gift,
  "scissors": Scissors, "smartphone": Smartphone,
  "heart-pulse": HeartPulse, "stethoscope": Stethoscope, "pill": Pill, "dumbbell": Dumbbell, "activity": Activity,
  "clapperboard": Clapperboard, "film": Film, "music": Music, "gamepad-2": Gamepad2,
  "graduation-cap": GraduationCap, "book": Book, "tv": Tv,
  "briefcase": Briefcase, "laptop": Laptop, "trending-up": TrendingUp,
  "badge-dollar-sign": BadgeDollarSign, "building-2": Building2,
  "tag": Tag, "star": Star, "heart": Heart, "dog": Dog, "baby": Baby, "wrench": Wrench, "phone": Phone,
  "circle-help": CircleHelp,
};

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
