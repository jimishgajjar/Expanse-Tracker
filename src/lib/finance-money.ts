import { findCurrencyByCode } from "./currencies";

const ZERO = BigInt(0), ONE = BigInt(1), TEN = BigInt(10);
const scale = (digits:number) => TEN ** BigInt(digits);

export function currencyDigits(currency:string) {
  if (!findCurrencyByCode(currency)) throw Error("Choose a supported currency.");
  return currency === "JPY" ? 0 : 2;
}

/** Parse decimal text without passing through a binary floating-point number. */
function decimal(value:string, digits:number) {
  if (typeof value !== "string" || !/^-?\d{1,52}(?:\.\d{1,16})?$/.test(value)) throw Error("Enter a decimal amount.");
  const [integer,fraction=""] = value.replace("-","").split(".");
  if (/[1-9]/.test(fraction.slice(digits))) throw Error("Too many decimal places for this currency or rate.");
  const units = BigInt(integer) * scale(digits) + BigInt(fraction.slice(0,digits).padEnd(digits,"0") || "0");
  return value.startsWith("-") ? -units : units;
}

function fixed(units:bigint,digits:number) {
  const value = (units < ZERO ? -units : units).toString().padStart(digits+1,"0");
  return (units<ZERO?"-":"") + (digits ? value.slice(0,-digits)+"."+value.slice(-digits) : value);
}

export const minor = (amount:string,currency:string) => decimal(amount,currencyDigits(currency));
export const money = (units:bigint,currency:string) => fixed(units,currencyDigits(currency));
export function displayMoney(value:string,currency:string) {
  const [whole,fraction]=money(minor(value,currency),currency).replace("-","").split(".");
  const locale=findCurrencyByCode(currency)!.locale;
  const grouped=new Intl.NumberFormat(locale).format(BigInt(whole));
  const separator=new Intl.NumberFormat(locale).formatToParts(1.5).find(p=>p.type==="decimal")?.value??".";
  return currency+" "+(value.startsWith("-")?"−":"")+grouped+(fraction?separator+fraction:"");
}
const RATE_DIGITS = 10;
function round(n:bigint,d:bigint) {
  const magnitude = ((n<ZERO?-n:n) * BigInt(2) + d) / (BigInt(2)*d);
  return n<ZERO ? -magnitude : magnitude;
}
export function rateUnits(rate:string) {
  const units = decimal(rate,RATE_DIGITS);
  if (units<=ZERO) throw Error("Enter a positive exchange rate.");
  return units;
}
/** Quote is destination major units per one source major unit. Round once, half away from zero. */
export function converted(amount:string, from:string, to:string, rate:string) {
  return money(round(minor(amount,from)*rateUnits(rate)*scale(currencyDigits(to)),
    scale(currencyDigits(from)+RATE_DIGITS)),to);
}

export function payoff(balance:string,currency:string,apr:string,payment:string,fee:string) {
  let remaining = minor(balance,currency);
  const installment = minor(payment,currency), monthlyFee = minor(fee,currency);
  const annual = decimal(apr,6), denominator = BigInt(1200)*scale(6);
  if (annual<ZERO || annual>BigInt(100)*scale(6) || installment<=ZERO || monthlyFee<ZERO) throw Error("Check the annual rate, payment and fee.");
  let interest = ZERO, fees = ZERO, finalPayment = ZERO, months = 0;
  while (remaining>ZERO && months<600) {
    const charge = round(remaining*annual,denominator);
    if (installment<=charge+monthlyFee) return {status:"Payment does not cover charges"} as const;
    const due = remaining+charge+monthlyFee;
    finalPayment = installment<due ? installment : due;
    remaining = due-finalPayment;
    interest += charge;
    fees += monthlyFee;
    months++;
  }
  if (remaining>ZERO) return {status:"Beyond the 50-year projection"} as const;
  return {status:"Projected",months,interest:money(interest,currency),fees:money(fees,currency),finalPayment:money(finalPayment,currency)} as const;
}

export function transferResidual(sent:string,from:string,received:string,to:string,rate:string) {
  if (from===to && (rateUnits(rate)!==scale(RATE_DIGITS) || minor(sent,from)!==minor(received,to))) throw Error("Same-currency transfer amounts must match.");
  const difference = minor(received,to)-minor(converted(sent,from,to,rate),to);
  if (difference < -ONE || difference > ONE) throw Error("The received amount differs from the quoted conversion by more than one minor unit. Check the rate and record fees separately.");
  return money(difference,to);
}
