import { InvariantViolationError } from "../shared/errors.js";
import type { MintAddress, TokenId } from "../shared/types.js";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((character, index) => [character, index]));

export type TokenProgram = "spl_token" | "token_2022" | "unknown";

export interface Token {
  readonly id: TokenId;
  readonly mint: MintAddress;
  readonly program: TokenProgram;
  readonly decimals: number;
}

function decodedBase58Length(value: string): number | null {
  if (value.length === 0) return null;

  const bytes: number[] = [0];
  for (const character of value) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) return null;

    let carry = digit;
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index]! * 58;
      bytes[index] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  const leadingZeroes = [...value].findIndex((character) => character !== "1");
  const zeroCount = leadingZeroes === -1 ? value.length : leadingZeroes;
  const significantBytes = bytes.length === 1 && bytes[0] === 0 ? 0 : bytes.length;
  return zeroCount + significantBytes;
}

export function asMintAddress(value: string): MintAddress {
  if (decodedBase58Length(value) !== 32) {
    throw new TypeError(`Invalid Solana mint address: ${value}`);
  }
  return value as MintAddress;
}

export function createToken(input: Token): Token {
  if (!Number.isInteger(input.decimals) || input.decimals < 0 || input.decimals > 255) {
    throw new InvariantViolationError("Token decimals must be an integer between 0 and 255", {
      decimals: String(input.decimals),
    });
  }

  return Object.freeze({ ...input });
}
