import {
  filter,
  finalize,
  merge,
  NEVER,
  Observable,
  ReplaySubject,
  share,
  startWith,
  Subject,
  switchMap,
  tap,
  timer,
} from 'rxjs';

import {DefaultStorage} from './default-storage';
import {HttpCacheOptions} from './http-cache-options';
import {RequestTimes} from './request-times';

type HttpRequestCacheMethod = (...args: any[]) => Observable<any>;

export const HttpRequestCache = <T extends Record<string, any>>(optionsHandler?: (obj: T, ...args: any[]) => HttpCacheOptions) => {
  return (
    target: T,
    methodName: string,
    descriptor: TypedPropertyDescriptor<HttpRequestCacheMethod>,
  ): TypedPropertyDescriptor<HttpRequestCacheMethod> => {
    if (!(descriptor?.value instanceof Function)) {
      throw Error(`'@HttpRequestCache' can be applied only to the class method which returns an Observable`);
    }

    const cacheKeyPrefix = `${target.constructor.name}_${methodName}`;
    const originalMethod = descriptor.value;
    const working: Record<string, boolean> = {};
    const subscribers: Record<string, number> = {};
    const removeTimers: Record<string, ReturnType<typeof setTimeout>> = {};
    const instanceIds = new WeakMap<object, number>();
    let instanceIdCounter = 0;

    descriptor.value = function(...args: any[]): Observable<any> {
      const self = (this as Record<string, any>) ?? target;
      const options = optionsHandler?.call(self as T, self as T, ...args);

      if (!options?.storage && !self.___storage___) {
        self.___storage___ = new DefaultStorage();
      }

      if (options?.ttl && !self.___ttl_storage___) {
        self.___ttl_storage___ = new RequestTimes();
      }

      const storage = options?.storage ?? self.___storage___;

      let instanceId = '';
      if (!options?.storage) {
        let id = instanceIds.get(self);
        if (id === undefined) {
          id = ++instanceIdCounter;
          instanceIds.set(self, id);
        }
        instanceId = `_${id}`;
      }

      const key = `${cacheKeyPrefix}${instanceId}_${JSON.stringify(args)}`;

      // отменяем запланированное удаление
      if (removeTimers[key]) {
        clearTimeout(removeTimers[key]);
        delete removeTimers[key];
      }

      let ttl: {requestTime: number, subject: Subject<void>} = undefined as any;

      if (options?.ttl) {
        ttl = self.___ttl_storage___.getItem(key);

        if (!ttl) {
          ttl = {
            requestTime: Date.now(),
            subject: new Subject(),
          };
        } else if (ttl.requestTime + options.ttl <= Date.now()) {
          working[key] = true;
          ttl.requestTime = Date.now();
          ttl.subject.next();
        }

        self.___ttl_storage___.setItem(key, ttl);
      }

      const refreshOn = merge(
        options?.refreshOn ?? NEVER as Observable<unknown>,
        ttl?.subject ?? NEVER as Observable<unknown>,
      );

      let observable = storage.getItem(key);

      if (!observable) {
        observable = refreshOn.pipe(
          startWith(true),
          switchMap(() => originalMethod.apply(this, [...args])),
          tap(() => {
            delete working[key];
          }),
          share({
            connector: () => new ReplaySubject(1),
            resetOnComplete: false,
            resetOnError: true,
            resetOnRefCountZero: !options?.refCount
              ? false
              : options.refCountDelay != null
                ? () => timer(options.refCountDelay!)
                : true,
          }),
          filter(() => !working[key]),
          finalize(() => {
            subscribers[key]--;

            if (subscribers[key] <= 0) {
              delete subscribers[key];

              if (options?.refCount) {
                const unset = () => {
                  storage.deleteItem(key);
                  self.___ttl_storage___?.deleteItem(key);

                  delete removeTimers[key];
                };

                if (options.refCountDelay == null) {
                  unset();
                } else {
                  removeTimers[key] = setTimeout(unset, options.refCountDelay);
                }
              }
            }
          }),
        );
        storage.setItem(key, observable);

        if (options?.windowTime) {
          setTimeout(
            () => {
              storage.deleteItem(key);
              self.___ttl_storage___?.deleteItem(key);
            },
            options.windowTime,
          );
        }
      }

      subscribers[key] = (subscribers[key] ?? 0) + 1;

      return observable;
    };

    return descriptor;
  };
};

