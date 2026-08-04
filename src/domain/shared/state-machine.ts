import { InvalidTransitionError } from "./errors.js";

export type TransitionTable<State extends string> = Readonly<Record<State, readonly State[]>>;

export interface StateMachine<State extends string> {
  canTransition(from: State, to: State): boolean;
  transition(from: State, to: State): State;
  allowedFrom(from: State): readonly State[];
}

export function createStateMachine<State extends string>(
  table: TransitionTable<State>,
): StateMachine<State> {
  const normalized = Object.fromEntries(
    Object.entries(table).map(([state, targets]) => [
      state,
      Object.freeze([...(targets as State[])]),
    ]),
  ) as Record<State, readonly State[]>;
  Object.freeze(normalized);

  return Object.freeze({
    canTransition(from: State, to: State): boolean {
      return normalized[from].includes(to);
    },
    transition(from: State, to: State): State {
      if (!normalized[from].includes(to)) throw new InvalidTransitionError(from, to);
      return to;
    },
    allowedFrom(from: State): readonly State[] {
      return normalized[from];
    },
  });
}
