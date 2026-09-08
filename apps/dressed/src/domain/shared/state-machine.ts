import { createStateMachine as createPlatformStateMachine } from "@timsys/app-sdk";
import { InvalidTransitionError } from "./errors.js";

export type TransitionTable<State extends string> = Readonly<Record<State, readonly State[]>>;

export function createStateMachine<State extends string>(table: TransitionTable<State>) {
  const platform = createPlatformStateMachine(table);
  return Object.freeze({
    canTransition: (from: State, to: State): boolean => platform.canTransition(from, to),
    transition(from: State, to: State): State {
      if (!platform.canTransition(from, to)) throw new InvalidTransitionError(from, to);
      return to;
    },
    allowedFrom: (from: State): readonly State[] => platform.allowedFrom(from),
  });
}
