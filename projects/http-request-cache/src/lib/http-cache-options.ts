import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {HttpCacheStorage} from './http-cache-storage';

export interface HttpCacheOptions {
  refCount?: boolean;
  refCountDelay?: number;
  windowTime?: number;
  ttl?: number;
  storage?: HttpCacheStorage;
  refreshOn?: Observable<unknown> | Subject<unknown> | BehaviorSubject<unknown>;
}
