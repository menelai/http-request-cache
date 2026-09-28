import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {delay} from 'rxjs/operators';
import {Observable, of} from 'rxjs';
import {LogService} from './log.service';

const API_HOST = 'https://api.example.com';

@Injectable()
export class FakeApiInterceptor implements HttpInterceptor {
  constructor(private log: LogService) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!req.url.startsWith(API_HOST)) {
      return next.handle(req);
    }

    const serial = this.log.nextSerial();
    this.log.http(req.url, serial);

    if (req.url.startsWith(`${API_HOST}/fail/`)) {
      return of<HttpEvent<any>>(
        new HttpErrorResponse({status: 500, statusText: 'fake server error'}) as unknown as HttpEvent<any>,
      ).pipe(delay(400));
    }

    const body = {
      url: req.url,
      value: serial,
      time: Date.now(),
    };

    return of<HttpEvent<any>>(
      new HttpResponse({status: 200, body}) as HttpEvent<any>,
    ).pipe(delay(500));
  }
}