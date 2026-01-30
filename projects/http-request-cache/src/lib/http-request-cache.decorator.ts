import {HttpCacheOptions} from './http-cache-options';
import {filter, finalize, merge, NEVER, Observable, Subject, tap, shareReplay, startWith, switchMap} from 'rxjs';
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
    let subscribers = 0;

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
          shareReplay({
            bufferSize: 1,
            refCount: options?.refCount ?? false,
          }),
          filter(() => {
            return !working[key];
          }),
          finalize(() => {
            subscribers--;
            if (subscribers === 0 && options?.refCount) {
              storage.deleteItem(key);
              (target as any)._____ttl_storage_____?.deleteItem(key);
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

      subscribers++;

      return observable;
    };

    return descriptor;
  }
}

