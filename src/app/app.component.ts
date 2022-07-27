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
    private jojService: JojService
  ) { }

  ngOnInit(): void {
    this.jojService.get(1).subscribe(g => {
      console.log('1', g);
    });

    setTimeout(() => {
      this.jojService.refresh$.next(1);
    }, 1000);

    setTimeout(() => {
      this.jojService.refresh$.next(1);
    }, 2000);

    // does not refresh
    setTimeout(() => {
      this.jojService.refresh$.next(2);
    }, 3000);
  }
}
