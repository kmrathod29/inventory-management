// Safe arithmetic evaluator for numeric inputs (Quantity, Price, Amount Paid).
// Supports + - * / ( ) decimals and unary minus via a small recursive-descent
// parser. It never uses eval()/new Function(), so arbitrary input is harmless.
//
// evalMath("500+120") -> 620
// evalMath("5*100")   -> 500
// evalMath("1000/4")  -> 250
// evalMath("")        -> null   (empty)
// evalMath("5+")      -> null   (invalid / incomplete)

function tokenize(str) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      let num = "";
      while (
        i < str.length &&
        ((str[i] >= "0" && str[i] <= "9") || str[i] === ".")
      ) {
        num += str[i++];
      }
      // reject "." alone or numbers with more than one decimal point
      if (num === "." || num.split(".").length > 2) return null;
      tokens.push({ type: "num", value: parseFloat(num) });
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
      continue;
    }
    return null; // unknown character
  }
  return tokens;
}

export function evalMath(input) {
  if (input === null || input === undefined) return null;
  const str = String(input).trim();
  if (str === "") return null;

  const tokens = tokenize(str);
  if (!tokens || tokens.length === 0) return null;

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  // expr = term (("+"|"-") term)*
  function parseExpr() {
    let left = parseTerm();
    if (left === null) return null;
    while (peek() && peek().type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = next().value;
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  // term = factor (("*"|"/") factor)*
  function parseTerm() {
    let left = parseFactor();
    if (left === null) return null;
    while (peek() && peek().type === "op" && (peek().value === "*" || peek().value === "/")) {
      const op = next().value;
      const right = parseFactor();
      if (right === null) return null;
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  // factor = ("+"|"-") factor | primary
  function parseFactor() {
    const t = peek();
    if (!t) return null;
    if (t.type === "op" && (t.value === "+" || t.value === "-")) {
      next();
      const val = parseFactor();
      if (val === null) return null;
      return t.value === "-" ? -val : val;
    }
    return parsePrimary();
  }

  // primary = number | "(" expr ")"
  function parsePrimary() {
    const t = peek();
    if (!t) return null;
    if (t.type === "num") {
      next();
      return t.value;
    }
    if (t.type === "paren" && t.value === "(") {
      next();
      const val = parseExpr();
      if (val === null) return null;
      const closing = peek();
      if (!closing || closing.type !== "paren" || closing.value !== ")") return null;
      next();
      return val;
    }
    return null;
  }

  const result = parseExpr();
  if (result === null) return null;
  if (pos !== tokens.length) return null; // leftover tokens => invalid
  if (!Number.isFinite(result)) return null; // e.g. division by zero
  return result;
}

// Convenience: evaluate and return a normalized string, or the original
// trimmed text when the expression is invalid (so the user can fix it).
export function commitMath(input) {
  const result = evalMath(input);
  if (result === null) return String(input ?? "").trim();
  // Trim floating point noise (e.g. 0.1+0.2) to at most 4 decimals.
  return String(Math.round(result * 10000) / 10000);
}
