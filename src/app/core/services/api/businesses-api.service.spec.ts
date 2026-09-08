import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BusinessesApiService } from './businesses-api.service';
import { environment } from '@env/environment';
import { Business, CreateBusinessData, CreateBusinessResponse } from '@models';

describe('BusinessesApiService', () => {
  let service: BusinessesApiService;
  let httpMock: HttpTestingController;

  const business: Business = {
    id: 1,
    name: 'Kinesilk Centro',
    rut: '12.345.678-9',
    email: 'negocio@test.com',
    address: 'Av. Providencia 123',
    phone: '+56912345678',
    plan: 'starter',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(BusinessesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  describe('getBusiness', () => {
    it('unwraps { data: Business }', () => {
      service.getBusiness().subscribe((res) => {
        expect(res).toEqual(business);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/businesses`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: business });
    });

    it('unwraps { data: null } when the user has no business yet', () => {
      service.getBusiness().subscribe((res) => {
        expect(res).toBeNull();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/businesses`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: null });
    });
  });

  describe('createBusiness', () => {
    it('POSTs data and returns the flat { data: Business, message?, warnings? } response', () => {
      const payload: CreateBusinessData = {
        name: 'Kinesilk Centro',
        rut: '12.345.678-9',
        email: 'negocio@test.com',
        address: 'Av. Providencia 123',
        phone: '+56912345678',
        plan: 'professional',
      };
      const response: CreateBusinessResponse = {
        data: business,
        message: 'ok',
      };

      service.createBusiness(payload).subscribe((res) => {
        expect(res).toEqual(response);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/businesses`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(response);
    });
  });
});
