import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {filter, interval, Observable, Subject} from 'rxjs';
import {HttpRequestCache} from 'http-request-cache';

@Injectable({
  providedIn: 'root'
})
export class JojService {

  refresh$ = new Subject<number>();

  constructor(
    private http: HttpClient,
  ) { }

  @HttpRequestCache<JojService>((jojService, id: number) => ({
    refreshOn: jojService.refresh$.pipe(
      filter(r => r === id),
    ),
  }))
  get(id: number): Observable<any> {
    return this.http.get(`https://jsonplaceholder.typicode.com/todos/${id}`);
  }
}
