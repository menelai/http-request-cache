import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {filter, Observable, Subject} from 'rxjs';
import {HttpRequestCache} from 'http-request-cache';

const API = 'https://api.example.com';

@Injectable({providedIn: 'root'})
export class ScenariosService {
  refresh$ = new Subject<number>();

  constructor(private http: HttpClient) {
  }

  @HttpRequestCache<ScenariosService>()
  base(id: number): Observable<any> {
    return this.http.get(`${API}/base/${id}`);
  }

  @HttpRequestCache<ScenariosService>((s, id: number) => ({
    refreshOn: s.refresh$.pipe(
      filter(r => r === id),
    ),
  }))
  withRefresh(id: number): Observable<any> {
    return this.http.get(`${API}/refresh/${id}`);
  }

  @HttpRequestCache<ScenariosService>((s, id: number) => ({
    ttl: 4000,
  }))
  withTtl(id: number): Observable<any> {
    return this.http.get(`${API}/ttl/${id}`);
  }

  @HttpRequestCache<ScenariosService>((s, id: number) => ({
    refCount: true,
  }))
  withRefCount(id: number): Observable<any> {
    return this.http.get(`${API}/refcount/${id}`);
  }

  @HttpRequestCache<ScenariosService>((s, id: number) => ({
    refCount: true,
    refCountDelay: 3000,
  }))
  withRefCountDelay(id: number): Observable<any> {
    return this.http.get(`${API}/refcountdelay/${id}`);
  }

  @HttpRequestCache<ScenariosService>((s, id: number) => ({
    windowTime: 3000,
  }))
  withWindowTime(id: number): Observable<any> {
    return this.http.get(`${API}/windowtime/${id}`);
  }

  @HttpRequestCache<ScenariosService>()
  withError(id: number): Observable<any> {
    return this.http.get(`${API}/fail/${id}`);
  }

  @HttpRequestCache<ScenariosService>()
  byObject(query: any): Observable<any> {
    return this.http.get(`${API}/obj`);
  }
}