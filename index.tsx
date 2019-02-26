import * as sagaEffects from 'redux-saga/effects';
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { connect, Provider } from 'react-redux';
import { mapObjIndexed } from 'ramda';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { takeEvery } from 'redux-saga/effects';
import createSagaMiddleware from 'redux-saga';

import { Action, Actions, WithActions, SyncDef, AsyncEffects, Effects, EffectDef, SyncReducers } from './types';

class ActionType {
  readonly type: string;

  static compose(namespace, actionName) {
    return new ActionType(namespace, actionName);
  }

  static decompose(actionType: string) {
    const [namespace, actionName] = actionType.slice(1).split('/');

    return new ActionType(namespace, actionName);
  }

  constructor(readonly namespace: string, readonly actionName: string) {
    this.type = `@${namespace}/${actionName}`;
  }

  get [Symbol.toStringTag]() {
    return this.type;
  }
}

const mapToActions = <N extends string>(
  namespace: string,
  def: { [K in N]: any },
): Actions<N> => mapObjIndexed(
  (_, key) => {
    const type = ActionType.compose(namespace, key);

    return (payload: any) => ({
      type: type.type,
      payload,
    });
  },
  def,
);

class Sync<S, N extends string> implements WithActions<N> {
  readonly actions: Actions<N>;
  readonly namespace: string;
  readonly initialState: S;
  private readonly reducers: SyncReducers<S, N>;

  constructor({
    namespace,
    state,
    reducers,
  }: SyncDef<S, N>) {
    this.reducers = reducers;
    this.namespace = namespace;
    this.initialState = state;
    this.actions = mapToActions(this.namespace, this.reducers);
  }

  reducer = (state = this.initialState, { type, payload }: Action<any>) => {
    const actionType = ActionType.decompose(type);
    const reducer = this.reducers[actionType.actionName];

    if (reducer) {
      return reducer(state, payload);
    }

    return state;
  };
}

class Async<N extends string> implements WithActions<N> {
  readonly actions: Actions<N>;
  readonly namespace: string;
  readonly effects: AsyncEffects<N>;
  private readonly def: Effects<N>;

  constructor({
    namespace,
    def,
  }: {
    namespace: string,
    def: Effects<N>,
  }) {
    this.def = def;
    this.namespace = namespace;
    this.actions = mapToActions(this.namespace, this.def); // TODO: Need to improve Actions related types.
    this.worker = this.worker.bind(this);

    this.effects = mapObjIndexed(
      (v: EffectDef<N>, key: string) => {
        const type = ActionType.compose(this.namespace, key);

        if (v instanceof Function) {
          return takeEvery(type.type, v.bind(this));
        }

        if (v instanceof Array) {
          const taker = sagaEffects[v[0]];
          const effect = v[1].bind(this);

          return taker(type.type, effect);
        }

        throw Error('wrong effect type');
      },
      this.def,
    );
  }

  * worker() {
    yield sagaEffects.all(this.effects);
  }
}

const Counter = new Sync({
  namespace: 'Counter',
  state: 0,
  reducers: {
    increment: state => state + 1,
    decrement: state => state - 1,
  },
});

const CostSync = new Sync({
  namespace: 'CostSync',
  state: 0,
  reducers: {
    set: (_, payload) => payload,
  }
});

const CostAsync = new Async({
  namespace: 'CostAsync',
  def: {
    run: [
      'takeLatest',
      function* run() {
        const t1 = performance.now();
        yield sagaEffects.delay(1000);
        yield sagaEffects.put(CostSync.actions.set(performance.now() - t1));
      },
    ],
  },
});

type Func = (...args: any) => any;

type AppProps = {
  counter: number;
  cost: number,
  increment: Func;
  decrement: Func;
  run: Func;
};

const App = connect(
  ({ counter, cost }) => ({ counter, cost }),
  { ...Counter.actions, ...CostAsync.actions },
)(({ counter, cost, run, increment, decrement }: AppProps) =>{
  return (
    <div>
      <button onClick={decrement}>-</button>
      {counter}
      <button onClick={increment}>+</button>

      <button onClick={run}>异步操作</button>
      耗时：{cost}
    </div>
  )
});

const reducer = combineReducers({
  cost: CostSync.reducer,
  counter: Counter.reducer,
});

const sagaMiddleware = createSagaMiddleware();
const store = createStore(reducer, applyMiddleware(sagaMiddleware));

sagaMiddleware.run(CostAsync.worker);

const appEl = document.querySelector('#app');

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  appEl,
);