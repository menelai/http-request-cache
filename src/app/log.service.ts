import {Injectable} from '@angular/core';
import {Observable, Subject} from 'rxjs';

export interface LogEntry {
  time: string;
  text: string;
}

@Injectable({providedIn: 'root'})
export class LogService {
  private entries: LogEntry[] = [];
  private eventsSubject = new Subject<LogEntry>();
  private counters = new Map<string, number>();
  private fetchSerial = 0;

  events: Observable<LogEntry> = this.eventsSubject.asObservable();

  nextSerial(): number {
    return ++this.fetchSerial;
  }

  http(url: string, serial: number): void {
    this.counters.set(url, (this.counters.get(url) ?? 0) + 1);
    this.push(`HTTP ${url}  ->  value #${serial}`);
  }

  push(text: string): void {
    const entry = {
      time: new Date().toLocaleTimeString(),
      text,
    };
    this.entries.push(entry);
    if (this.entries.length > 400) {
      this.entries.shift();
    }
    this.eventsSubject.next(entry);
  }

  counter(url: string): number {
    return this.counters.get(url) ?? 0;
  }

  clear(): void {
    this.entries = [];
    this.counters.clear();
    this.push('лог очищен');
  }
}