import { InvalidTransitionError } from "./errors.js";

export type TransitionTable<State extends string> = Readonly<Record<State, readonly State[]>>;

export function createStateMachine<State extends string>(table: TransitionTable<State>) {
  const normalized = Object.freeze(
    Object.fromEntries(
      Object.entries(table).map(([state, targets]) => [state, Object.freeze([...(targets as State[])])]),
    ) as Record<State, readonly State[]>,
  );
  return Object.freeze({
    canTransition: (from: State, to: State): boolean => normalized[from].includes(to),
    transition(from: State, to: State): State {
      if (!normalized[from].includes(to)) throw new InvalidTransitionError(from, to);
      return to;
    },
    allowedFrom: (from: State): readonly State[] => normalized[from],
  });
}

