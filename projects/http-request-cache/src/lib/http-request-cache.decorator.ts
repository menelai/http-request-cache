import {HttpCacheOptions} from './http-cache-options';
import {
  filter, finalize, merge, NEVER, Observable, Subject, tap, shareReplay, startWith, switchMap, share,
  ReplaySubject, timer
} from 'rxjs';
import {DefaultStorage} from './default-storage';
import {RequestTimes} from './request-times';

type HttpRequestCacheMethod = (...args: any[]) => Observable<any>;

export const HttpRequestCache = <T extends Record<string, any>>(optionsHandler?: (obj: T, ...args: any[]) => HttpCacheOptions) => {
  return (target: T, methodName: string, descriptor: TypedPropertyDescriptor<HttpRequestCacheMethod>): TypedPropertyDescriptor<HttpRequestCacheMethod> => {
    if (!(descriptor?.value instanceof Function)) {
      throw Error(`'@HttpRequestCache' can be applied only to the class method which returns an Observable`);
    }

    const cacheKeyPrefix = `${target.constructor.name}_${methodName}`;
    const originalMethod = descriptor.value;
    const working: Record<string, boolean> = {};
    const subscribers: Record<string, number> = {};
    const removeTimers: Record<string, ReturnType<typeof setTimeout>> = {};

    descriptor.value = function(...args: any[]): Observable<any> {
      const options = optionsHandler?.call(this as T, this as T, ...args);

      if (!options?.storage && !(target as any)._____storage_____) {
        (target as any)._____storage_____ = new DefaultStorage();
      }

      if (options?.ttl && !(target as any)._____ttl_storage_____) {
        (target as any)._____ttl_storage_____ = new RequestTimes();
      }

      const storage = options?.storage ?? (target as any)._____storage_____;

      const key = `${cacheKeyPrefix}_${JSON.stringify(args)}`;

      // отменяем запланированное удаление
      if (removeTimers[key]) {
        clearTimeout(removeTimers[key]);
        delete removeTimers[key];
      }

      let ttl: {requestTime: number, subject: Subject<void>} = undefined as any;

      if (options?.ttl) {
        ttl = (target as any)._____ttl_storage_____.getItem(key);

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

        (target as any)._____ttl_storage_____.setItem(key, ttl);
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
            resetOnRefCountZero: options?.refCount && options.refCountDelay != null
              ? () => timer(options.refCountDelay!)
              : false,
          }),
          filter(() => !working[key]),
          finalize(() => {
            subscribers[key]--;

            if (subscribers[key] <= 0) {
              delete subscribers[key];

              if (options?.refCount) {
                const unset = () => {
                  storage.deleteItem(key);
                  (target as any)._____ttl_storage_____?.deleteItem(key);

                  delete removeTimers[key];
                };

                if (options.refCountDelay == null) {
                  unset();
                } else {
                  removeTimers[key] = setTimeout(unset, options.refCountDelay);
                }
              }
            }
          })
        );
        storage.setItem(key, observable);

        if (options?.windowTime) {
          setTimeout(
            () => {
              storage.deleteItem(key);
              (target as any)._____ttl_storage_____?.deleteItem(key);
            },
            options.windowTime,
          );
        }
      }

      subscribers[key]++;

      return observable;
    };

    return descriptor;
  }
}

