import {
  finalize, merge, NEVER, Observable, Subject, startWith, switchMap, share,
  ReplaySubject, timer,
} from 'rxjs';

import {DefaultStorage} from './default-storage';
import {HttpCacheOptions} from './http-cache-options';
import {RequestTimes} from './request-times';

type HttpRequestCacheMethod = (...args: any[]) => Observable<any>;

const serializeArg = (value: any): string => {
  const seen = new WeakMap<object, string>();
  let counter = 0;

  const serialize = (v: any): string => {
    if (v === null) {
      return 'null';
    }
    const t = typeof v;

    if (t === 'number' || t === 'boolean') {
      return String(v);
    }
    if (t === 'bigint') {
      return `${v}n`;
    }
    if (t === 'undefined' || t === 'symbol' || t === 'function') {
      return 'undef';
    }
    if (t === 'string') {
      return `str:${v}`;
    }
    if (t !== 'object') {
      return `${t}:${String(v)}`;
    }

    if (v instanceof Date) {
      return `date:${v.toISOString()}`;
    }
    if (v instanceof RegExp) {
      return `regexp:${v.toString()}`;
    }

    const path = seen.get(v);
    if (path !== undefined) {
      return `circ:${path}`;
    }
    seen.set(v, `v${counter++}`);

    let out: string;
    if (v instanceof Map) {
      out = `map:${serialize(Array.from(v.entries()))}`;
    } else if (v instanceof Set) {
      out = `set:${serialize(Array.from(v.values()))}`;
    } else if (Array.isArray(v)) {
      out = `[${v.map(serialize).join(',')}]`;
    } else {
      out = `{${Object.keys(v).sort().map(k => `${serialize(k)}:${serialize(v[k])}`).join(',')}}`;
    }

    seen.delete(v);
    return out;
  };

  return serialize(value);
};

const hashArgs = (input: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
};

export const HttpRequestCache = <T extends Record<string, any>>(optionsHandler?: (obj: T, ...args: any[]) => HttpCacheOptions) => {
  return (target: T, methodName: string, descriptor: TypedPropertyDescriptor<HttpRequestCacheMethod>): TypedPropertyDescriptor<HttpRequestCacheMethod> => {
    if (typeof descriptor?.value !== 'function') {
      throw Error(`'@HttpRequestCache' can be applied only to the class method which returns an Observable`);
    }

    const cacheKeyPrefix = `${target.constructor.name}_${methodName}`;
    const originalMethod = descriptor.value;
    const latestCall: Record<string, {self: any, args: any[]}> = {};

    const instanceIds = new WeakMap<object, number>();
    let instanceIdCounter = 0;

    descriptor.value = function(...args: any[]): Observable<any> {
      const self = this as Record<string, any>;
      const options = optionsHandler?.call(self as T, self as T, ...args);

      const useDefaultStorage = !options?.storage;
      if (useDefaultStorage && !self.___storage___) {
        self.___storage___ = new DefaultStorage();
      }

      const ttlEnabled = options?.ttl != null;
      if (ttlEnabled && !self.___ttl_storage___) {
        self.___ttl_storage___ = new RequestTimes();
      }

      const storage = options?.storage ?? self.___storage___;
      const ttlStorage = self.___ttl_storage___;

      let instanceId = '';
      if (useDefaultStorage) {
        let id = instanceIds.get(self);
        if (id === undefined) {
          id = ++instanceIdCounter;
          instanceIds.set(self, id);
        }
        instanceId = `_${id}`;
      }

      const key = `${cacheKeyPrefix}${instanceId}_${hashArgs(serializeArg(args))}`;
      const latest = latestCall[key] ?? (latestCall[key] = {self, args});
      latest.self = self;
      latest.args = args;

      let ttl: {requestTime: number, subject: Subject<void>} = undefined as any;

      if (ttlEnabled && ttlStorage) {
        ttl = ttlStorage.getItem(key);

        if (!ttl) {
          ttl = {
            requestTime: Date.now(),
            subject: new Subject(),
          };
        } else if (ttl.requestTime + (options?.ttl as number) <= Date.now()) {
          ttl.requestTime = Date.now();
          ttl.subject.next();
        }

        ttlStorage.setItem(key, ttl);
      }

      const refreshOn = merge(
        options?.refreshOn ?? NEVER as Observable<unknown>,
        ttl?.subject ?? NEVER as Observable<unknown>,
      );

      let observable = storage.getItem(key);

      if (!observable) {
        const ttlRemaining = ttlEnabled && ttl
          ? ttl.requestTime + (options?.ttl as number) - Date.now()
          : 0;

        observable = refreshOn.pipe(
          startWith(true),
          switchMap(() => originalMethod.apply(latest.self, latest.args)),
          finalize(() => {
            storage.deleteItem(key);
            ttlStorage?.deleteItem(key);
            delete latestCall[key];
          }),
          share({
            connector: () => new ReplaySubject(1),
            resetOnComplete: false,
            resetOnError: true,
            resetOnRefCountZero: options?.refCount
              ? options.refCountDelay != null
                ? (): Observable<number> => timer(options.refCountDelay!)
                : true
              : ttlRemaining > 0
                ? (): Observable<number> => timer(ttlRemaining)
                : true,
          }),
        );
        storage.setItem(key, observable);

        if (options?.windowTime) {
          setTimeout(
            () => {
              storage.deleteItem(key);
              ttlStorage?.deleteItem(key);
              delete latestCall[key];
            },
            options.windowTime,
          );
        }
      }

      return observable;
    };

    return descriptor;
  };
};
