import {Component, OnInit} from '@angular/core';
import {JojService} from './joj.service';
import {HttpClient} from '@angular/common/http';
import {shareReplay, take} from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {

  constructor(
    private http: HttpClient,
    private jojService: JojService
  ) { }

  ngOnInit(): void {
    this.jojService.get().pipe(
      take(1)
    ).subscribe(g => {
      console.log('1', g);
    });

    this.jojService.get1().pipe(
      take(1)
    ).subscribe(g => {
      console.log('get1', g);
    });

    setTimeout(() => {
      this.jojService.get1().subscribe(g => {
        console.log('get2', g);
      });
    }, 1000);

    setTimeout(() => {
      this.jojService.get().subscribe(g => {
        console.log('2', g);
      });
    }, 1000);

    setTimeout(() => {
      this.jojService.get().subscribe(g => {
        console.log('3', g);
      });
    }, 6000);

    setTimeout(() => {
      this.jojService.get().pipe(
        take(1)
      ).subscribe(g => {
        console.log('4', g);
      });
    }, 8000);
  }
}
