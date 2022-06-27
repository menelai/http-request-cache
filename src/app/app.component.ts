import {Component, OnInit} from '@angular/core';
import {JojService} from './joj.service';
import {HttpClient} from '@angular/common/http';
import {shareReplay} from 'rxjs/operators';

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
    this.jojService.get().subscribe(g => {
      console.log('1', g);
    });

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
      this.jojService.get().subscribe(g => {
        console.log('4', g);
      });
    }, 8000);
  }
}
