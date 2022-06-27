# HttpRequestCache

TS decorator for caching logic of API calls.

Inspired by [How to use TS decorators to add caching logic to API calls](https://indepth.dev/posts/1450/how-to-use-ts-decorators-to-add-caching-logic-to-api-calls)

## Installation

```
npm install @kovalenko/http-request-cache
```

## Supported API

`@HttpRequestCache<T>((thisObj?: T, ...args: any[]) => HttpCacheOptions)` — A method decorator that will cache data

`thisObj` is this object

`args` are decorated method's arguments

```typescript
interface HttpCacheOptions {
  refCount?: boolean; // If `refCount` is true, the source will be unsubscribed from once the reference count drops to zero
  windowTime?: number; // Maximum time length of the replay buffer in milliseconds
  ttl?: number; // cache time to live before it will be refreshed. Unlike refreshOn: interval(1000), ttl will not refresh automatically
  storage?: HttpCacheStorage; // if none specified, the default cache object will be used
  refreshOn?: Observable<unknown> | Subject<unknown> | BehaviorSubject<unknown>; // refresh trigger
}
```

```typescript
export interface HttpCacheStorage {
  setItem(key: string, item: Observable<any>): void; // sets cache
  getItem(key: string): Observable<any> | undefined; // gets cache
  deleteItem(key: string): void; // deletes cache
}
```

## Usage

### Default cache storage

```typescript
@Injectable()
export class DataService {
  refresh$ = new Subject();
  constructor(private http: HttpClient) { }

  @HttpRequestCache<DataService>(dataService => ({
    refreshOn: dataService.refresh$
  }))
  list(): Observable<any> {
    return this.http.get('assets/angular.json');
  }
}
```

### Unsubscribe internal ReplaySubject when there are no subscribers

```typescript
@Injectable()
export class DataService {
  constructor(private http: HttpClient) { }

  @HttpRequestCache<DataService>(dataService => ({
    refCount: true // set refCount to true to unsubscribe cache
  }))
  list(): Observable<any> {
    return this.http.get('assets/angular.json');
  }
}
```

### Custom cache storage

```typescript
@Injectable()
export class DataService {
  refresh$ = new Subject();
  constructor(private http: HttpClient, private cacheService: CacheService) { }

  @HttpRequestCache<DataService>(dataService => ({
    storage: dataService.cacheService,
    refreshOn: dataService.refresh$
  }))
  list(): Observable<any> {
    return this.http.get('assets/angular.json');
  }
}
```

### Parametrized refresh

```typescript
@Injectable()
export class DataService {
  refresh$ = new Subject<string>();
  constructor(private http: HttpClient) { }

  @HttpRequestCache<DataService>((dataService, id: string) => ({
    refreshOn: dataService.refresh$.pipe(filter(r => r === id))
  }))
  list(id: string): Observable<any> {
    return this.http.get('assets/angular.json');
  }
}
```

### TTL

When someone subscribes list() method after TTL period, every subscription is being refreshed

```typescript
@Injectable()
export class DataService {
  constructor(private http: HttpClient) { }

  @HttpRequestCache(() => ({
    ttl: 5000
  }))
  list(): Observable<any> {
    return this.http.get('assets/angular.json');
  }
}


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {

  constructor(
    private http: HttpClient,
    private dataService: DataService
  ) { }

  ngOnInit(): void {
    this.dataService.list().subscribe(g => {
      console.log('1', g);
    });
    
    // outputs: 
    // 1 {...}

    setTimeout(() => {
      this.dataService.list().subscribe(g => {
        console.log('2', g);
      });
    }, 1000);

    // outputs: 
    // 2 {...}

    setTimeout(() => {
      this.dataService.list().subscribe(g => {
        console.log('3', g);
      });
    }, 6000);

    // outputs: 
    // 1 {...}
    // 2 {...}
    // 3 {...}

    setTimeout(() => {
      this.dataService.list().subscribe(g => {
        console.log('4', g);
      });
    }, 8000);

    // outputs: 
    // 4 {...}
  }
}
```

### If cache invalidation is not necessary
```typescript
@Injectable()
export class DataService {
  constructor(private http: HttpClient) { }

  @HttpRequestCache()
  list(): Observable<any> {
    return this.http.get('assets/angular.json');
  }
}
```

## License

[MIT](LICENSE)
