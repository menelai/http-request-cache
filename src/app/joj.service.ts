import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {interval, Observable} from 'rxjs';
import {HttpRequestCache} from 'http-request-cache';

@Injectable({
  providedIn: 'root'
})
export class JojService {

  constructor(
    private http: HttpClient,
  ) { }

  @HttpRequestCache(() => ({
    ttl: 4000
  }))
  get(): Observable<any> {
    return this.http.get('https://jsonplaceholder.typicode.com/todos/1');
  }
}
