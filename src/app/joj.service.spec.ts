import { TestBed } from '@angular/core/testing';

import { JojService } from './joj.service';

describe('JojService', () => {
  let service: JojService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(JojService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
