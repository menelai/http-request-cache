import {HttpCacheOptions} from './http-cache-options';
import {filter, merge, NEVER, Observable, Subject, tap} from 'rxjs';
import {shareReplay, startWith, switchMap} from 'rxjs/operators';
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

      (target as any)._____working_____ ??= {};

      let ttl: {requestTime: number, subject: Subject<void>} = undefined as any;

      if (options?.ttl) {
        ttl = (target as any)._____ttl_storage_____.getItem(key);

        if (!ttl) {
          ttl = {
            requestTime: Date.now(),
            subject: new Subject(),
          };
        } else if (ttl.requestTime + options.ttl <= Date.now()) {
          (target as any)._____working_____[key] = true;
          ttl.requestTime = Date.now();
          ttl.subject.next();
        }

        (target as any)._____ttl_storage_____.setItem(key, ttl);
      }

      const refreshOn = merge(
        options?.refreshOn ?? NEVER as Observable<unknown>,
         ttl?.subject ?? NEVER,
      );

      let observable = storage.getItem(key);

      if (!observable) {
        observable = refreshOn.pipe(
          startWith(true),
          switchMap(() => originalMethod.apply(this, [...args])),
          tap(() => {
            delete (target as any)._____working_____[key];
          }),
          shareReplay({
            bufferSize: 1,
            refCount: options?.refCount ?? false,
            windowTime: options?.windowTime ?? Infinity,
          }),
          filter(() => {
            return !(target as any)._____working_____[key];
          }),
        );
        storage.setItem(key, observable);
      }

      return observable;
    };

    return descriptor;
  }
}

