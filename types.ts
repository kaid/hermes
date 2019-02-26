import { ForkEffect } from 'redux-saga/effects';

export interface Action<P> {
  type: string;
  payload?: P;
}

export interface ActionCreator<P> {
  (payload?: P): Action<P>
}

export type Actions<N extends string> = {
  [K in N]: ActionCreator<any>;
}

export interface Reducer<S, P> {
  (initialState: S, payload?: P): S;
}

export interface WithActions<N extends string> {
  readonly actions: Actions<N>;
}

export type SyncReducers<S, A extends string> = {
  [K in A]: Reducer<S, any>;
};

export type SyncDef<S, N extends string> = {
  namespace: string,
  state: S,
  reducers: SyncReducers<S, N>,
}

export interface Effect<P> extends Function {
  (payload: P): Generator | any
}

export type TakerType = 'takeEvery' | 'takeLatest' | 'takeLeading';

export type EffectDef<P> = [TakerType, Effect<P>] | Effect<P>;

export type Effects<N extends string> = {
  [K in N]: EffectDef<any>;
};

export type AsyncEffects<N extends string> = {
  [K in N]: ForkEffect;
};
