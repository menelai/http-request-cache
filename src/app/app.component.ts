import {Component} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, Subscription} from 'rxjs';
import {LogEntry, LogService} from './log.service';
import {ScenariosService} from './scenarios.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  logs: LogEntry[] = [];

  readonly watched = [
    {label: 'базовый кэш', url: 'https://api.example.com/base/5'},
    {label: 'другой аргумент', url: 'https://api.example.com/base/6'},
    {label: 'инстансы', url: 'https://api.example.com/base/7'},
    {label: 'refreshOn', url: 'https://api.example.com/refresh/1'},
    {label: 'ttl', url: 'https://api.example.com/ttl/5'},
    {label: 'refCount', url: 'https://api.example.com/refcount/5'},
    {label: 'refCountDelay', url: 'https://api.example.com/refcountdelay/5'},
    {label: 'windowTime', url: 'https://api.example.com/windowtime/5'},
    {label: 'ошибка', url: 'https://api.example.com/fail/1'},
    {label: 'объектные аргументы', url: 'https://api.example.com/obj'},
  ];

  constructor(
    private log: LogService,
    private scenarios: ScenariosService,
    private http: HttpClient,
  ) {
    this.log.events.subscribe(e => this.logs.push(e));
  }

  counter(url: string): number {
    return this.log.counter(url);
  }

  clearLog(): void {
    this.logs = [];
    this.log.clear();
  }

  private subscribe(tag: string, observable: Observable<any>): Subscription {
    this.log.push(`${tag}: подписка`);
    return observable.subscribe({
      next: v => this.log.push(`${tag}: value #${v?.value}`),
      error: e => this.log.push(`${tag}: ERROR ${e?.status}/${e?.message ?? e}`),
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scenarioSameArgs(): Promise<void> {
    this.log.push('Сценарий 1: два подписчика с одинаковыми аргументами. Ожидание: 1 HTTP');
    const a = this.subscribe('S1/A', this.scenarios.base(5));
    const b = this.subscribe('S1/B', this.scenarios.base(5));
    await this.wait(1200);
    a.unsubscribe();
    b.unsubscribe();
    this.log.push('S1: готово. base/5 должен быть без изменений (1)');
  }

  async scenarioDifferentArgs(): Promise<void> {
    this.log.push('Сценарий 2: разные аргументы = разные ключи. Ожидание: 2 HTTP');
    const a = this.subscribe('S2/A', this.scenarios.base(5));
    await this.wait(600);
    const b = this.subscribe('S2/B', this.scenarios.base(6));
    await this.wait(600);
    a.unsubscribe();
    b.unsubscribe();
    this.log.push('S2: готово. base/5 = 1, base/6 = 1');
  }

  async scenarioRefresh(): Promise<void> {
    this.log.push('Сценарий 3: refreshOn по id. refresh(1) должен обновить, refresh(2) нет');
    const s = this.subscribe('S3/R', this.scenarios.withRefresh(1));
    await this.wait(1200);
    this.log.push('S3: refresh$.next(1). Ожидание: новый HTTP и новое значение у подписчика');
    this.scenarios.refresh$.next(1);
    await this.wait(1200);
    this.log.push('S3: refresh$.next(2). НЕ должно обновить id=1 (HTTP не должен расти)');
    this.scenarios.refresh$.next(2);
    await this.wait(1200);
    s.unsubscribe();
    this.log.push('S3: готово');
  }

  async scenarioTtl(): Promise<void> {
    this.log.push('Сценарий 4: ttl=4s. A(0s), A2(2s — кэш), B(6s — ttl истёк, рефетч; A и B получают новое значение)');
    const a = this.subscribe('S4/A', this.scenarios.withTtl(5));
    await this.wait(2000);
    const a2 = this.subscribe('S4/A2', this.scenarios.withTtl(5));
    await this.wait(4000);
    const b = this.subscribe('S4/B', this.scenarios.withTtl(5));
    await this.wait(1200);
    a.unsubscribe();
    a2.unsubscribe();
    b.unsubscribe();
    this.log.push('S4: готово. ttl/5 должно вырасти при подписке B');
  }

  async scenarioRefCount(): Promise<void> {
    this.log.push('Сценарий 5: refCount=true. отписка -> удаление кэша -> повторная подписка = новый HTTP');
    const s = this.subscribe('S5/R', this.scenarios.withRefCount(5));
    await this.wait(1200);
    s.unsubscribe();
    this.log.push('S5: отписка (~1.2s)');
    await this.wait(1200);
    const s2 = this.subscribe('S5/R2', this.scenarios.withRefCount(5));
    await this.wait(1200);
    s2.unsubscribe();
    this.log.push('S5: готово. refcount/5 должен вырасти после повторной подписки');
  }

  async scenarioRefCountDelay(): Promise<void> {
    this.log.push('Сценарий 6: refCount=true, refCountDelay=3s. D(0s) -> отписка(1s), D2(2.5s — кэш в пределах delay), отписка D2(3.5s), D3(8s — простой > 3s -> новый HTTP)');
    const s = this.subscribe('S6/D', this.scenarios.withRefCountDelay(5));
    await this.wait(1000);
    s.unsubscribe();
    this.log.push('S6: D отписался (~1s), запущен refCountDelay 3s');
    await this.wait(1500);
    const s2 = this.subscribe('S6/D2', this.scenarios.withRefCountDelay(5));
    await this.wait(1000);
    this.log.push('S6: D2 подписался в пределах delay -> кэш, HTTP не растёт');
    s2.unsubscribe();
    this.log.push('S6: D2 отписался (~3.5s), снова запущен refCountDelay 3s');
    await this.wait(4500);
    const s3 = this.subscribe('S6/D3', this.scenarios.withRefCountDelay(5));
    await this.wait(1200);
    s3.unsubscribe();
    this.log.push('S6: готово. D3 после простоя > 3s -> новый HTTP (value #2)');
  }

  async scenarioWindowTime(): Promise<void> {
    this.log.push('Сценарий 7: windowTime=3s. W(0s), W2(2s — кэш), W3(5s — окно ушло, новый HTTP)');
    const a = this.subscribe('S7/W', this.scenarios.withWindowTime(5));
    await this.wait(2000);
    const b = this.subscribe('S7/W2', this.scenarios.withWindowTime(5));
    await this.wait(3000);
    const c = this.subscribe('S7/W3', this.scenarios.withWindowTime(5));
    await this.wait(1200);
    a.unsubscribe();
    b.unsubscribe();
    c.unsubscribe();
    this.log.push('S7: готово. HTTP должен вырасти только при W3');
  }

  async scenarioError(): Promise<void> {
    this.log.push('Сценарий 8: ошибка на стороне сервера. E ловит ошибку, E2 (после сброса) = новый HTTP');
    const s = this.subscribe('S8/E', this.scenarios.withError(1));
    await this.wait(1500);
    const s2 = this.subscribe('S8/E2', this.scenarios.withError(1));
    await this.wait(1500);
    s.unsubscribe();
    s2.unsubscribe();
    this.log.push('S8: готово. fail/1 должен вырасти при E и E2');
  }

  async scenarioInstances(): Promise<void> {
    this.log.push('Сценарий 9: два инстанса с одинаковыми аргументами. Кэш привязан к инстансу -> 2 HTTP');
    const a = new ScenariosService(this.http);
    const b = new ScenariosService(this.http);
    const sa = this.subscribe('S9/A', a.base(7));
    const sb = this.subscribe('S9/B', b.base(7));
    await this.wait(1200);
    sa.unsubscribe();
    sb.unsubscribe();
    this.log.push('S9: готово. base/7 должен быть 2 (по одному на инстанс)');
  }

  async scenarioObjectArgs(): Promise<void> {
    this.log.push('Сценарий 10: объектные аргументы. {a,b} -> {b,a} (порядок ключей). JSON.stringify даёт разные ключи -> 2 HTTP');
    const a = this.subscribe('S10/O1', this.scenarios.byObject({a: 1, b: 2}));
    await this.wait(1200);
    const b = this.subscribe('S10/O2', this.scenarios.byObject({b: 2, a: 1}));
    await this.wait(1200);
    const c = this.subscribe('S10/O3', this.scenarios.byObject({a: 1, b: 2}));
    await this.wait(1200);
    a.unsubscribe();
    b.unsubscribe();
    c.unsubscribe();
    this.log.push('S10: готово. Obj. O3 должен быть из кэша (growth = 2 всего)');
  }
}