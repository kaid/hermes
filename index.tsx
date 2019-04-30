import * as sagaEffects from 'redux-saga/effects';
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { connect, Provider } from 'react-redux';
import { mapObjIndexed, clone, update, remove } from 'ramda';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { takeEvery } from 'redux-saga/effects';
import createSagaMiddleware from 'redux-saga';
import { List, Checkbox, Input, Icon } from 'antd';
import 'antd/dist/antd.less';

import { Action, Actions, WithActions, SyncDef, AsyncEffects, Effects, EffectDef, SyncReducers } from './types';

import './index.less';

const { useEffect } = React;

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

  constructor({
    namespace,
    effects: _effects,
  }: {
    namespace: string,
    effects: Effects<N>,
  }) {
    this.namespace = namespace;
    this.actions = mapToActions(this.namespace, _effects); // TODO: Need to improve Actions related types.
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
      _effects,
    );
  }

  * worker() {
    yield sagaEffects.all(this.effects);
  }
}

const ENDPOINT = 'http://localhost:8888';

const InitialEditState ={
  edit: { id: null, content: null },
  new: { id: null, content: null },
};

const TodoEditStore = new Sync({
  namespace: 'TodoListStore',
  state: clone(InitialEditState),
  reducers: {
    setEditing: (state, { isEdit, id, content }) => ({
      ...state,
      [isEdit ? 'edit' : 'new']: { id, content: content || '' },
    }),

    resetEditing: () => clone(InitialEditState),
  }
});

const TodoListStore = new Sync({
  namespace: 'TodoListStore',
  state: null,
  reducers: {
    setList: (_, payload) => clone(payload),
  }
});

const TodoListSaga = new Async({
  namespace: 'TodoListSaga',
  effects: {
    * fetchList() {
      const { data } = yield fetch(ENDPOINT).then(res => res.json());
      yield sagaEffects.put(TodoListStore.actions.setList(data));
    },
    * postList({ payload: list }) {
      yield fetch(ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(list),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      yield sagaEffects.put(TodoListStore.actions.setList(list));
      yield sagaEffects.put(TodoEditStore.actions.resetEditing());
    }
  },
});

type Func = (...args: any) => any;

type EditorProps = {
  icon?: string;
  content: string;
  onChange: Func;
  onSubmit: Func;
};

const Editor = ({ content, onChange, onSubmit, icon = 'plus' }: EditorProps) => (
  <Input
    type="text"
    value={content}
    onChange={onChange}
    onKeyPress={e => {
      if (e.charCode === 13) {
        onSubmit();
      }
    }}
    addonAfter={
      <Icon type={icon} onClick={onSubmit} />
    }
  />
);

type Todo = {
  id: number;
  done: boolean;
  content: string;
};

type TodoListProps = {
  todoList: Todo[];
  editing: { new: Todo, edit: Todo };
  onSubmit: Func;
  setEditing: Func;
};

const TodoList = ({
  editing,
  todoList,
  onSubmit,
  setEditing,
}: TodoListProps) => (
  <List
    bordered
    header="待办事项"
    dataSource={todoList}
    renderItem={(todo, index) => (
      <List.Item>
        <div className="todo-item">
          <Checkbox
            checked={todo.done}
            onChange={({ target: { checked: done } }) => onSubmit(update(
              index,
              { ...todo, done },
              todoList,
            ))}
          />
          {
            todo.id === editing.edit.id
            ? (
              <Editor
                icon="caret-right"
                content={editing.edit.content} 
                onChange={({ target: { value } }) => setEditing({
                  isEdit: true,
                  id: todo.id,
                  content: value,
                })}
                onSubmit={() => onSubmit(update(
                  index,
                  editing.edit,
                  todoList,
                ))}
              />
            )
            : (
              <div
                className="todo-content"
                onClick={() => setEditing({
                  isEdit: true,
                  id: todo.id,
                  content: todo.content,
                })}
              >
                {
                  todo.done
                  ? (
                    <i><s>{todo.content}</s></i>
                  )
                  : todo.content
                }
              </div>
            )
          }
          <Icon
            type="close-circle"
            onClick={() => onSubmit(remove(
              index,
              1,
              todoList,
            ))}
          />
        </div>
      </List.Item>
    )}
    footer={(
      <Editor
        content={editing.new.content}
        onChange={({ target: { value } }) => setEditing({
          isEdit: false,
          id: editing.new.id || Date.now(),
          content: value,
        })}
        onSubmit={() => onSubmit([
          ...todoList,
          { ...editing.new, done: false },
        ])}
      />
    )}
  />
);

type AppProps = {
  todoList: Todo[],
  editing: any,
  setEditing: Func,
  setList: Func;
  postList: Func;
  fetchList: Func;
};

const App = connect(
  ({ todoList, editing }) => ({ todoList, editing }),
  { ...TodoListSaga.actions, ...TodoListStore.actions, ...TodoEditStore.actions },
)(({ todoList, editing, setList, postList, fetchList, setEditing }: AppProps) =>{
  useEffect(() => {
    if (todoList === null) {
      fetchList();
    }
  });

  return (
    <div className="main">
      <TodoList
        editing={editing}
        setEditing={setEditing}
        onSubmit={postList}
        todoList={todoList || []}
      />
    </div>
  )
});

const reducer = combineReducers({
  todoList: TodoListStore.reducer,
  editing: TodoEditStore.reducer,
});

const sagaMiddleware = createSagaMiddleware();
const store = createStore(reducer, applyMiddleware(sagaMiddleware));

sagaMiddleware.run(TodoListSaga.worker);

const appEl = document.querySelector('#app');

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  appEl,
);